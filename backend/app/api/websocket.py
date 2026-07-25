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

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
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
            
            content = payload.get("content") or payload.get("text")
            message_type = payload.get("message_type", "text")
            
            if user_id and content:
                try:
                    with SessionLocal() as message_db:
                        msg_schema = MessageCreate(content=content, message_type=message_type)
                        db_msg = activity_repository.create_message(message_db, message_in=msg_schema, arena_id=arena_id, user_id=user_id)
                        
                        user_info = user_repository.get_by_id(message_db, id=user_id)
                        sender_name = user_info.full_name if (user_info and getattr(user_info, 'full_name', None)) else f"Member #{user_id}"
                        sender_avatar_url = get_user_avatar_url(message_db, user_id)
                        
                        broadcast_payload = {
                            "event_type": "chat_message",
                            "id": db_msg.id,
                            "arena_id": arena_id,
                            "user_id": user_id,
                            "sender_name": sender_name,
                            "sender_avatar_url": sender_avatar_url,
                            "content": content,
                            "text": content,
                            "message_type": message_type,
                            "created_at": str(db_msg.created_at)
                        }
                    
                    await manager.broadcast_to_arena(arena_id, broadcast_payload)
                except Exception as e:
                    print(f"Error processing WebSocket message: {str(e)}")
                    continue
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket, arena_id)
    except Exception as e:
        manager.disconnect(websocket, arena_id)
        print(f"WebSocket error in arena {arena_id}: {str(e)}")