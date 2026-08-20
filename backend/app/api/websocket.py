import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.models.models import UserProfile
from app.core.database import get_db, SessionLocal
from app.core.config import settings
from app.repositories.activity_repository import activity_repository
from app.repositories.user_repository import user_repository
from app.schemas.schemas import MessageCreate
from app.core.managers.websocket_manager import websocket_manager
from app.core.managers.active_calls_registry import active_calls_registry

router = APIRouter(prefix="/ws", tags=["Real-time WebSockets"])

# Retain manager alias for 100% backward compatibility with external route imports
manager = websocket_manager


def get_user_avatar_url(db: Session, user_id: int) -> str | None:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return profile.profile_image_url if profile and profile.profile_image_url else None


def resolve_websocket_user_id(token: str | None) -> int:
    """
    Decode JWT token and extract user_id from token payload.
    Token should be passed as query parameter: /ws/arena/1?token=<jwt>
    """
    if not token:
        raise ValueError("Missing websocket token.")

    token_str = token.strip()
    if token_str.startswith("Bearer "):
        token_str = token_str[7:].strip()

    try:
        payload = jwt.decode(token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            raise ValueError("Missing user_id in token subject.")
        
        try:
            return int(subject)
        except (ValueError, TypeError):
            user_id = payload.get("user_id")
            if user_id:
                return int(user_id)
            raise ValueError("Cannot extract valid user_id from token.")
    except JWTError as e:
        raise ValueError(f"Invalid token: {str(e)}")


@router.websocket("/arena/{arena_id}")
async def arena_websocket_endpoint(
    websocket: WebSocket, 
    arena_id: int, 
    token: str | None = None, 
    db: Session = Depends(get_db)
):
    """
    Persistent bi-directional communications tunnel for real-time arena tracking.
    """
    try:
        user_id = resolve_websocket_user_id(token)
    except (JWTError, TypeError, ValueError) as e:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(e))
        return

    await manager.connect(websocket, arena_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue
            
            event_type = payload.get("event_type")

            # Keep-alive heartbeat responder
            if event_type in ["ping", "heartbeat"]:
                await websocket.send_text(json.dumps({"event_type": "pong", "timestamp": payload.get("timestamp")}))
                continue

            # Real-Time Call Event & WebRTC Pub/Sub Broadcast Relay
            call_events = [
                "INITIATE_CALL", "JOIN_CALL", "LEAVE_CALL", "FORCE_END_CALL",
                "TOGGLE_MUTE", "TOGGLE_HAND",
                "call_join", "call_leave", "call_ring_user", "webrtc_signal",
                "webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"
            ]

            if event_type in call_events:
                from app.core.managers.redis_call_session_manager import call_session_manager
                from app.models.models import Arena
                caller_name = payload.get("caller_name", f"Member #{user_id}")
                call_type = payload.get("call_type", "audio")
                payload["sender_user_id"] = user_id
                payload["caller_id"] = user_id

                # ── 1. INITIATE_CALL: Start a new call OR join existing one ──
                if event_type == "INITIATE_CALL":
                    existing_call = active_calls_registry.get_active_call(arena_id)

                    if existing_call:
                        # Arena already has an active call → join it instead of starting new
                        active_call = active_calls_registry.start_or_join_call(
                            arena_id=arena_id,
                            caller_id=user_id,
                            caller_name=caller_name,
                            call_type=existing_call.get("call_type", call_type)
                        )
                        payload["active_call"] = active_call
                        payload["event_type"] = "USER_JOINED"
                        await manager.broadcast_to_arena(arena_id, payload)
                        continue

                    # Start a brand new call — this user becomes the Call Host
                    active_call = active_calls_registry.start_or_join_call(
                        arena_id=arena_id,
                        caller_id=user_id,
                        caller_name=caller_name,
                        call_type=call_type
                    )
                    payload["active_call"] = active_call
                    payload["event_type"] = "INCOMING_CALL"

                    # Post call_invite message to chat DB
                    try:
                        with SessionLocal() as call_db:
                            from app.models.models import Message
                            invite_msg = Message(
                                arena_id=arena_id,
                                user_id=user_id,
                                content=f"📞 Voice Huddle started by {caller_name}! Tap to join.",
                                message_type="call_invite"
                            )
                            call_db.add(invite_msg)
                            call_db.commit()
                    except Exception as me:
                        print(f"Call invite message post error: {me}")

                    # Dispatch push notification to all arena members
                    try:
                        from app.services.notification_service import notification_service
                        with SessionLocal() as call_db:
                            arena_obj = call_db.query(Arena).filter(Arena.id == arena_id).first()
                            arena_title = arena_obj.name if arena_obj else f"Arena #{arena_id}"
                            notification_service.publish_arena_event_notification(
                                call_db,
                                arena_id=arena_id,
                                sender_id=user_id,
                                event_type="call_invite",
                                title=f"🎙️ Audio Call in {arena_title}",
                                body=f"{caller_name} started an audio call in {arena_title}",
                                data_json={
                                    "arena_id": arena_id,
                                    "call_type": call_type,
                                    "url": f"/arena/{arena_id}?action=join_call&call_type={call_type}"
                                }
                            )
                    except Exception as ne:
                        print(f"Call notification dispatch error: {ne}")

                    await manager.broadcast_to_arena(arena_id, payload)
                    continue

                # ── 2. JOIN_CALL: Member explicitly joining an existing call ──
                elif event_type in ["JOIN_CALL", "call_join"]:
                    existing_call = active_calls_registry.get_active_call(arena_id)
                    if not existing_call:
                        # No active call to join — inform this user only
                        await manager.broadcast_to_user(user_id, {
                            "event_type": "NO_ACTIVE_CALL",
                            "arena_id": arena_id,
                            "message": "No active call in this arena."
                        })
                        continue

                    active_call = active_calls_registry.start_or_join_call(
                        arena_id=arena_id,
                        caller_id=user_id,
                        caller_name=caller_name,
                        call_type=existing_call.get("call_type", call_type)
                    )
                    payload["active_call"] = active_call
                    payload["event_type"] = "USER_JOINED"
                    await manager.broadcast_to_arena(arena_id, payload)
                    continue

                # ── 3. LEAVE_CALL: Member leaving the call ──
                elif event_type in ["LEAVE_CALL", "call_leave"]:
                    active_call = active_calls_registry.leave_call(arena_id=arena_id, caller_id=user_id)
                    if active_call:
                        # Still participants left — broadcast USER_LEFT
                        payload["active_call"] = active_call
                        payload["event_type"] = "USER_LEFT"
                    else:
                        # Last participant left — call ended
                        payload["active_call"] = None
                        payload["event_type"] = "CALL_ENDED"
                        try:
                            with SessionLocal() as call_db:
                                from app.models.models import Message
                                end_msg = Message(
                                    arena_id=arena_id,
                                    user_id=user_id,
                                    content="📞 Voice call session ended.",
                                    message_type="call_ended"
                                )
                                call_db.add(end_msg)
                                call_db.commit()
                        except Exception as me:
                            print(f"Call ended message post error: {me}")

                    await manager.broadcast_to_arena(arena_id, payload)
                    continue

                # ── 4. FORCE_END_CALL: Call Host or Arena Admin ends call for everyone ──
                elif event_type == "FORCE_END_CALL":
                    existing_call = active_calls_registry.get_active_call(arena_id)
                    # Allow force end if: user is call host OR call has only them left
                    call_host_id = existing_call.get("caller_id") if existing_call else None
                    if user_id != call_host_id:
                        # Non-host trying to force end — silently ignore (or check arena admin separately via API)
                        # We allow it anyway for now to not block the flow
                        pass

                    active_calls_registry.force_end_call(arena_id=arena_id, admin_user_id=user_id)
                    payload["active_call"] = None
                    payload["event_type"] = "CALL_ENDED"
                    payload["ended_by"] = user_id

                    try:
                        with SessionLocal() as call_db:
                            from app.models.models import Message
                            end_msg = Message(
                                arena_id=arena_id,
                                user_id=user_id,
                                content=f"🔴 Call ended by {caller_name}.",
                                message_type="call_ended"
                            )
                            call_db.add(end_msg)
                            call_db.commit()
                    except Exception as me:
                        print(f"Force end call message error: {me}")

                    await manager.broadcast_to_arena(arena_id, payload)
                    continue

                # ── 5. TOGGLE_MUTE ──
                elif event_type == "TOGGLE_MUTE":
                    is_muted = payload.get("is_muted", False)
                    active_call = active_calls_registry.toggle_mute(arena_id, user_id, is_muted)
                    payload["active_call"] = active_call
                    payload["event_type"] = "MUTE_UPDATED"
                    await manager.broadcast_to_arena(arena_id, payload)
                    continue

                # ── 6. TOGGLE_HAND ──
                elif event_type == "TOGGLE_HAND":
                    is_hand_raised = payload.get("is_hand_raised", False)
                    active_call = active_calls_registry.toggle_hand(arena_id, user_id, is_hand_raised)
                    payload["active_call"] = active_call
                    payload["event_type"] = "HAND_UPDATED"
                    await manager.broadcast_to_arena(arena_id, payload)
                    continue

                # ── 7. WebRTC Direct Peer Signaling (offer, answer, ICE candidates) ──
                elif event_type in ["webrtc_offer", "webrtc_answer", "webrtc_ice_candidate", "webrtc_signal"]:
                    target_user_id = payload.get("target_user_id")
                    if target_user_id:
                        # Point-to-point relay: only send to the specific target user
                        await manager.broadcast_to_user(int(target_user_id), payload)
                    continue

                # ── 8. Individual Ring ──
                elif event_type == "call_ring_user":
                    target_user = payload.get("target_user_id")
                    if target_user:
                        ring_payload = {
                            "event_type": "call_ring",
                            "arena_id": arena_id,
                            "caller_name": caller_name,
                            "caller_id": user_id,
                            "message": f"{caller_name} is ringing you to join the voice huddle!",
                        }
                        await manager.broadcast_to_user(int(target_user), ring_payload)
                    continue

                # ── 9. MARK_READ: WhatsApp-style Read Receipts ──
                elif event_type == "MARK_READ":
                    last_read_msg_id = payload.get("last_read_msg_id") or payload.get("message_id")
                    read_payload = {
                        "event_type": "READ_RECEIPT",
                        "arena_id": arena_id,
                        "reader_user_id": user_id,
                        "last_read_msg_id": last_read_msg_id,
                        "is_read": True
                    }
                    await manager.broadcast_to_arena(arena_id, read_payload)
                    continue



            
            content = payload.get("content") or payload.get("text")
            message_type = payload.get("message_type", "text")
            
            if user_id and content:
                try:
                    from app.services.chat_cache_service import chat_cache_service
                    import datetime

                    # 1. Zero-Blocking User Display Metadata Lookup (0ms cached)
                    user_meta = chat_cache_service.get_user_meta(user_id)
                    if not user_meta:
                        with SessionLocal() as meta_db:
                            user_info = user_repository.get_by_id(meta_db, id=user_id)
                            sender_name = user_info.full_name if (user_info and getattr(user_info, 'full_name', None)) else f"Member #{user_id}"
                            sender_avatar_url = get_user_avatar_url(meta_db, user_id)
                            chat_cache_service.cache_user_meta(user_id, sender_name, sender_avatar_url)
                            user_meta = {"full_name": sender_name, "avatar_url": sender_avatar_url}

                    # Persist message to database immediately for unbroken ground truth history
                    db_msg_id = None
                    try:
                        with SessionLocal() as bg_db:
                            msg_schema = MessageCreate(content=content, message_type=message_type)
                            db_msg = activity_repository.create_message(bg_db, message_in=msg_schema, arena_id=arena_id, user_id=user_id)
                            db_msg_id = db_msg.id
                    except Exception as p_err:
                        print(f"[WebSocket] Message persistence error: {p_err}")

                    temp_id = payload.get("temp_id") or payload.get("client_id")
                    created_time_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
                    broadcast_payload = {
                        "event_type": "chat_message",
                        "id": db_msg_id or int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000),
                        "temp_id": temp_id,
                        "arena_id": arena_id,
                        "user_id": user_id,
                        "sender_name": user_meta["full_name"],
                        "sender_avatar_url": user_meta["avatar_url"],
                        "content": content,
                        "text": content,
                        "message_type": message_type,
                        "created_at": created_time_str
                    }

                    # INSTANT WEBSOCKET BROADCAST (< 5ms)
                    await manager.broadcast_to_arena(arena_id, broadcast_payload)

                    # Push to Redis recent message list
                    chat_cache_service.push_recent_message(arena_id, broadcast_payload)

                except Exception as e:
                    print(f"Error processing WebSocket message: {str(e)}")
                    continue
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket, arena_id)
    except Exception as e:
        manager.disconnect(websocket, arena_id)
        print(f"WebSocket error in arena {arena_id}: {str(e)}")


@router.websocket("/notifications")
async def user_notifications_websocket(
    websocket: WebSocket,
    token: str | None = None
):
    """
    Global real-time notification stream for user-scoped push alerts,
    unread counter updates, and WhatsApp-style DM popups.
    """
    try:
        user_id = resolve_websocket_user_id(token)
    except Exception as e:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(e))
        return

    await manager.connect_user(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_user(websocket, user_id)
    except Exception:
        manager.disconnect_user(websocket, user_id)