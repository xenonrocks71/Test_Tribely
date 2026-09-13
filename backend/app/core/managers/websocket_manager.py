"""
Real-time WebSocket Connection Manager & Redis Pub/Sub Scale-Out Adapter.
Handles arena-scoped connection pools, real-time message broadcasting, active client tracking,
and Redis Pub/Sub integration for multi-node horizontally scaled deployments (Instagram Scale).
"""

import json
import asyncio
from typing import Dict, List, Set, Any, Optional
from fastapi import WebSocket
from app.core.config import settings

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False


class RoomConnectionPool:
    """
    Encapsulates an active WebSocket connection pool for a specific Arena room.
    """

    def __init__(self, room_id: int) -> None:
        """
        Initialize pool for a specific room identifier.

        :param room_id: Arena room ID.
        """
        self.room_id: int = room_id
        self.active_connections: Set[WebSocket] = set()

    def add(self, websocket: WebSocket) -> None:
        """
        Add WebSocket client to room pool.

        :param websocket: FastAPI WebSocket instance.
        """
        self.active_connections.add(websocket)

    def remove(self, websocket: WebSocket) -> None:
        """
        Remove WebSocket client from room pool.

        :param websocket: FastAPI WebSocket instance.
        """
        self.active_connections.discard(websocket)

    def is_empty(self) -> bool:
        """Check whether room pool has zero active connections."""
        return len(self.active_connections) == 0

    async def _safe_send(self, ws: WebSocket, payload: str) -> Optional[WebSocket]:
        """
        Send payload to a single WebSocket client with strict timeout isolation.
        Returns the WebSocket instance if sending failed or timed out (for automatic pruning).
        """
        try:
            await asyncio.wait_for(ws.send_text(payload), timeout=1.5)
            return None
        except Exception:
            return ws

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcast JSON payload concurrently to all active client connections using scatter-gather.
        Eliminates head-of-line blocking: slow or dead clients time out in 1.5s and are pruned immediately.

        :param message: Dict message payload to serialize.
        """
        if not self.active_connections:
            return

        payload = json.dumps(message)
        connections_snapshot = list(self.active_connections)
        results = await asyncio.gather(
            *[self._safe_send(ws, payload) for ws in connections_snapshot],
            return_exceptions=True
        )

        for res in results:
            if res is not None and not isinstance(res, BaseException):
                self.remove(res)

    async def broadcast_except(self, exclude_ws: Optional[WebSocket], message: Dict[str, Any]) -> None:
        """
        Broadcast JSON payload concurrently to all room connections EXCEPT the specified sender socket.
        """
        if not self.active_connections:
            return

        payload = json.dumps(message)
        connections_snapshot = [ws for ws in self.active_connections if not (exclude_ws and ws == exclude_ws)]
        if not connections_snapshot:
            return

        results = await asyncio.gather(
            *[self._safe_send(ws, payload) for ws in connections_snapshot],
            return_exceptions=True
        )

        for res in results:
            if res is not None and not isinstance(res, BaseException):
                self.remove(res)



class RedisPubSubManager:
    """
    Asynchronous Redis Pub/Sub Manager powering multi-instance horizontal scaling.
    Publishes events to Redis channels and listens for cluster-wide room updates.
    """

    def __init__(self) -> None:
        self.redis_client: Optional[Any] = None
        self.pubsub: Optional[Any] = None
        self._subscribed_channels: Set[str] = set()
        self._is_connected: bool = False

    async def connect(self) -> bool:
        """Initialize connection to Redis instance."""
        if not HAS_REDIS:
            return False

        try:
            is_ssl = (
                "upstash.io" in settings.REDIS_HOST
                or settings.REDIS_HOST.startswith("rediss://")
                or getattr(settings, "REDIS_SSL", False)
            )
            self.redis_client = aioredis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                ssl=is_ssl,
                ssl_cert_reqs=None if is_ssl else None,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                retry_on_timeout=True,
            )
            await self.redis_client.ping()
            self._is_connected = True
            return True
        except Exception as e:
            print(f"[RedisPubSubManager] Redis not connected (fallback to local in-memory pool): {e}")
            self._is_connected = False
            return False

    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        """
        Publish JSON message to Redis cluster channel.

        :param channel: Redis channel topic string (e.g. "arena:101").
        :param message: Dict payload.
        """
        if not self._is_connected or not self.redis_client:
            return

        try:
            await self.redis_client.publish(channel, json.dumps(message))
        except Exception as e:
            print(f"[RedisPubSubManager] Publish error on channel {channel}: {e}")

    async def subscribe_and_listen(self, channel: str, callback: Any) -> None:
        """
        Subscribe to channel and run async loop reading messages.

        :param channel: Redis channel name.
        :param callback: Async callback invoked when message arrives.
        """
        if not self._is_connected or not self.redis_client or channel in self._subscribed_channels:
            return

        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(channel)
            self._subscribed_channels.add(channel)

            async for item in pubsub.listen():
                if item["type"] == "message":
                    try:
                        data = json.loads(item["data"])
                        await callback(data)
                    except Exception as err:
                        print(f"[RedisPubSubManager] Error processing channel {channel} message: {err}")
        except Exception as e:
            print(f"[RedisPubSubManager] Subscription error on channel {channel}: {e}")
            self._subscribed_channels.discard(channel)


import uuid

class WebSocketManager:
    """
    Global Object-Oriented Manager controlling room connection pools across the application.
    Supports multi-node horizontal scaling via Redis Pub/Sub adapters.
    """

    def __init__(self) -> None:
        """Initialize global WebSocket manager with empty room pools map."""
        self._rooms: Dict[int, RoomConnectionPool] = {}
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self.pubsub_manager: RedisPubSubManager = RedisPubSubManager()
        self._listener_tasks: Dict[int, asyncio.Task] = {}
        self.instance_id: str = uuid.uuid4().hex

    async def connect_user(self, websocket: WebSocket, user_id: int) -> None:
        """Accept and register user-scoped WebSocket for real-time notifications."""
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)

    def disconnect_user(self, websocket: WebSocket, user_id: int) -> None:
        """Remove user-scoped WebSocket."""
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: Dict[str, Any]) -> None:
        """Broadcast payload to all active WebSockets owned by target user."""
        if user_id in self.user_connections:
            payload = json.dumps(message)
            stale = []
            for ws in list(self.user_connections[user_id]):
                try:
                    await ws.send_text(payload)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                self.user_connections[user_id].discard(ws)

    async def broadcast_to_all_users(self, message: Dict[str, Any]) -> None:
        """Broadcast payload to all active user-scoped WebSocket connections."""
        if not self.user_connections:
            return
        payload = json.dumps(message)
        for user_id, sockets in list(self.user_connections.items()):
            stale = []
            for ws in list(sockets):
                try:
                    await asyncio.wait_for(ws.send_text(payload), timeout=1.5)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                sockets.discard(ws)
            if not sockets:
                self.user_connections.pop(user_id, None)

    def _get_or_create_room(self, arena_id: int) -> RoomConnectionPool:

        """Retrieve existing room pool or instantiate new room pool."""
        if arena_id not in self._rooms:
            self._rooms[arena_id] = RoomConnectionPool(room_id=arena_id)
        return self._rooms[arena_id]

    async def connect(self, websocket: WebSocket, arena_id: int) -> None:
        """
        Accept incoming WebSocket connection and register it under target room pool.

        :param websocket: Incoming WebSocket request object.
        :param arena_id: Target arena room ID.
        """
        await websocket.accept()
        room = self._get_or_create_room(arena_id)
        room.add(websocket)

        # Attempt initializing Redis Pub/Sub cluster listener for this room
        if not self.pubsub_manager._is_connected:
            await self.pubsub_manager.connect()

        if self.pubsub_manager._is_connected and arena_id not in self._listener_tasks:
            channel = f"arena:{arena_id}"
            
            async def room_callback(data: Dict[str, Any]):
                # If this message was published by the same server instance, skip it (already broadcasted to local room)
                if data.get("_origin") == self.instance_id:
                    return
                if arena_id in self._rooms:
                    clean_data = {k: v for k, v in data.items() if k != "_origin"}
                    await self._rooms[arena_id].broadcast(clean_data)

            task = asyncio.create_task(
                self.pubsub_manager.subscribe_and_listen(channel, room_callback)
            )
            self._listener_tasks[arena_id] = task

    def disconnect(self, websocket: WebSocket, arena_id: int) -> None:
        """
        Deregister a disconnected WebSocket client from the room pool and clean up empty pools.

        :param websocket: Target WebSocket client instance.
        :param arena_id: Arena room ID.
        """
        if arena_id in self._rooms:
            room = self._rooms[arena_id]
            room.remove(websocket)
            if room.is_empty():
                del self._rooms[arena_id]
                if arena_id in self._listener_tasks:
                    self._listener_tasks[arena_id].cancel()
                    del self._listener_tasks[arena_id]

    async def broadcast_to_arena(self, arena_id: int, message: Dict[str, Any]) -> None:
        """
        Broadcast a message payload to all connected clients inside a specific arena.
        Publishes to Redis cluster channel for multi-instance broadcast if available.

        :param arena_id: Target arena room ID.
        :param message: Dict containing message details.
        """
        # 1. Local node pool broadcast
        if arena_id in self._rooms:
            await self._rooms[arena_id].broadcast(message)

        # 2. Redis cluster-wide pub/sub broadcast (tag with instance_id to avoid echo)
        if self.pubsub_manager._is_connected:
            channel = f"arena:{arena_id}"
            pub_payload = dict(message)
            pub_payload["_origin"] = self.instance_id
            await self.pubsub_manager.publish(channel, pub_payload)

    async def broadcast_to_arena_except(
        self,
        arena_id: int,
        exclude_ws: Optional[WebSocket],
        exclude_user_id: Optional[int],
        message: Dict[str, Any]
    ) -> None:
        """
        Broadcast payload to all connected clients inside arena EXCEPT the initiating sender socket / user ID.
        """
        if arena_id in self._rooms:
            await self._rooms[arena_id].broadcast_except(exclude_ws, message)

        if self.pubsub_manager._is_connected:
            channel = f"arena:{arena_id}"
            msg_copy = dict(message)
            if exclude_user_id:
                msg_copy["_exclude_user_id"] = exclude_user_id
            await self.pubsub_manager.publish(channel, msg_copy)


    def get_active_connection_count(self, arena_id: int) -> int:
        """
        Get count of active connections for a given arena.

        :param arena_id: Arena room ID.
        :return: Integer connection count.
        """
        if arena_id in self._rooms:
            return len(self._rooms[arena_id].active_connections)
        return 0

    def safe_broadcast_to_arena(self, arena_id: int, message: Dict[str, Any]) -> None:
        """
        Safely broadcast a message payload to an arena from either synchronous or asynchronous thread contexts.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast_to_arena(arena_id, message))
        except RuntimeError:
            try:
                asyncio.run(self.broadcast_to_arena(arena_id, message))
            except Exception as err:
                print(f"[WebSocketManager] safe_broadcast_to_arena sync execution error: {err}")
        except Exception as err:
            print(f"[WebSocketManager] safe_broadcast_to_arena task error: {err}")


# Global Singleton Instance for WebSocket Manager
websocket_manager = WebSocketManager()

