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


@router.websocket("/{arena_id}")
@router.websocket("/arena/{arena_id}")
async def arena_websocket_endpoint(
    websocket: WebSocket, 
    arena_id: int, 
    token: str | None = None
):
    """
    Persistent bi-directional communications tunnel for real-time arena tracking.
    Enforces JWT authentication and private Arena authorization.
    """
    try:
        user_id = resolve_websocket_user_id(token)
    except (JWTError, TypeError, ValueError) as e:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(e))
        return

    # Enforce private arena authorization check
    db = SessionLocal()
    try:
        from app.models.models import Arena, ArenaMembership
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Arena not found")
            return
        if arena.is_private and arena.creator_id != user_id:
            mem = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.user_id == user_id,
                ArenaMembership.status == "approved"
            ).first()
            if not mem:
                await websocket.accept()
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied: Private Arena")
                return
    finally:
        db.close()

    await manager.connect(websocket, arena_id)
    manager.connect_user(websocket, user_id)
    
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

            # Read Receipts (WhatsApp-style instant synchronization)
            if event_type == "MARK_READ":
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
        manager.disconnect_user(websocket, user_id)
    except Exception as e:
        manager.disconnect(websocket, arena_id)
        manager.disconnect_user(websocket, user_id)
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