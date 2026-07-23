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
        
        # Subject is typically the user_id or email
        # Try to convert to int if it's a user_id, otherwise use as-is
        try:
            return int(subject)
        except (ValueError, TypeError):
            # If subject is not a number, it might be email
            # In that case, we need to extract user_id from elsewhere in token
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
    
    Connection URL format: ws://localhost:8000/ws/arena/{arena_id}?token={jwt_token}
    
    Message format (from client):
    {
        "content": "message text",
        "message_type": "text"  (optional, defaults to "text")
    }
    
    Broadcast message format (to all clients):
    {
        "event_type": "chat_message",
        "id": <message_id>,
        "arena_id": <arena_id>,
        "user_id": <user_id>,
        "sender_name": "<user's full name>",
        "sender_avatar_url": "<url or null>",
        "content": "<message text>",
        "message_type": "text",
        "created_at": "<ISO timestamp>"
    }
    """
    try:
        # 1. Extract and validate JWT token
        user_id = resolve_websocket_user_id(token)
    except (JWTError, TypeError, ValueError) as e:
        # Close connection with policy violation code if token is invalid
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(e))
        return

    # 2. Accept the WebSocket connection
    await manager.connect(websocket, arena_id)
    
    try:
        while True:
            # 3. Block and listen for text packets coming from the client
            data = await websocket.receive_text()
            
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                # Invalid JSON from client, skip silently
                continue
            
            # 4. Extract message content (try multiple field names for flexibility)
            content = payload.get("content") or payload.get("text")
            message_type = payload.get("message_type", "text")
            
            if user_id and content:
                try:
                    # 5. Persist the message row historically via PostgreSQL transaction pool
                    msg_schema = MessageCreate(content=content, message_type=message_type)
                    db_msg = crud_activity.create_message(db, message_in=msg_schema, arena_id=arena_id, user_id=user_id)
                    
                    # 6. Fetch user info for display
                    user_info = crud_user.get_user(db, user_id=user_id)
                    sender_name = user_info.full_name if (user_info and hasattr(user_info, 'full_name') and user_info.full_name) else f"Member #{user_id}"
                    sender_avatar_url = get_user_avatar_url(db, user_id)
                    
                    # 7. Broadcast the formatted message instantly to all live room peers
                    broadcast_payload = {
                        "event_type": "chat_message",
                        "id": db_msg.id,
                        "arena_id": arena_id,
                        "user_id": user_id,
                        "sender_name": sender_name,  # Displays the human name on UI
                        "sender_avatar_url": sender_avatar_url,
                        "content": content,
                        "text": content,  # Fallback key to support simple frontend bindings
                        "message_type": message_type,
                        "created_at": str(db_msg.created_at)
                    }
                    await manager.broadcast_to_arena(arena_id, broadcast_payload)
                except Exception as e:
                    # Log error but don't break connection
                    print(f"Error processing WebSocket message: {str(e)}")
                    continue
                    
    except WebSocketDisconnect:
        # Client disconnected normally
        manager.disconnect(websocket, arena_id)
    except Exception as e:
        # Unexpected error - close connection gracefully
        manager.disconnect(websocket, arena_id)
        print(f"WebSocket error in arena {arena_id}: {str(e)}")