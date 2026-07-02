import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import Dict, List
from app.models.models import User
from app.models.models import UserProfile
from app.core.database import get_db
from app.core.config import settings
from app.crud import crud_activity, crud_user
from app.schemas.schemas import MessageCreate

router = APIRouter(prefix="/ws", tags=["Real-time WebSockets"])

class ConnectionManager:
    def __init__(self):
        # Maps Arena ID (int) -> List of active WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, arena_id: int):
        await websocket.accept()
        if arena_id not in self.active_connections:
            self.active_connections[arena_id] = []
        self.active_connections[arena_id].append(websocket)

    def disconnect(self, websocket: WebSocket, arena_id: int):
        if arena_id in self.active_connections:
            if websocket in self.active_connections[arena_id]:
                self.active_connections[arena_id].remove(websocket)
            if not self.active_connections[arena_id]:
                del self.active_connections[arena_id]

    async def broadcast_to_arena(self, arena_id: int, message: dict):
        """
        Sends a JSON message object to every connected user inside a specific arena.
        """
        if arena_id in self.active_connections:
            for connection in self.active_connections[arena_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Pass silently if a connection drops mid-broadcast
                    pass

manager = ConnectionManager()


def get_user_avatar_url(db: Session, user_id: int) -> str | None:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return profile.profile_image_url if profile and profile.profile_image_url else None


def resolve_websocket_user_id(token: str | None) -> int:
    if not token:
        raise ValueError("Missing websocket token.")

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    subject = payload.get("sub")
    if subject is None:
        raise ValueError("Missing websocket subject.")

    return int(subject)

@router.websocket("/arena/{arena_id}")
async def arena_websocket_endpoint(websocket: WebSocket, arena_id: int, token: str | None = None, db: Session = Depends(get_db)):
    """
    Persistent bi-directional communications tunnel for real-time arena tracking.
    """
    try:
        user_id = resolve_websocket_user_id(token)
    except (JWTError, TypeError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, arena_id)
    
    try:
        while True:
            # 1. Block and listen for text packets coming from the client
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # Authenticated socket identity is the source of truth.
            content = payload.get("content") or payload.get("text")
            
            if user_id and content:
                # 2. Persist the message row historically via PostgreSQL transaction pool
                msg_schema = MessageCreate(content=content, message_type="text")
                db_msg = crud_activity.create_message(db, message_in=msg_schema, arena_id=arena_id, user_id=user_id)
                
                user_info = crud_user.get_user_by_id(db, user_id=user_id)
                sender_name = user_info.full_name if (user_info and user_info.full_name) else f"Member #{user_id}"
                sender_avatar_url = get_user_avatar_url(db, user_id)
                
                # 3. Broadcast the formatted message instantly to all live room peers
                broadcast_payload = {
                    "event_type": "chat_message",
                    "id": db_msg.id,
                    "arena_id": arena_id,
                    "user_id": user_id,
                    "sender_name": sender_name,  # Displays the human name on UI
                    "sender_avatar_url": sender_avatar_url,
                    "content": content,
                    "text": content,             #Fallback key to support simple frontend bindings
                    "message_type": "text",
                    "created_at": str(db_msg.created_at)
                }
                await manager.broadcast_to_arena(arena_id, broadcast_payload)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, arena_id)
    except Exception:
        manager.disconnect(websocket, arena_id)