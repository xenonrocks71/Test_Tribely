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

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcast JSON payload to all active client connections in this room pool.
        Isolates client send exceptions so dead sockets are cleaned up without interrupting active clients.

        :param message: Dict message payload to serialize.
        """
        payload = json.dumps(message)
        stale_connections = []
        
        # Take a snapshot list copy to prevent Set size modification during iteration
        connections_snapshot = list(self.active_connections)
        for connection in connections_snapshot:
            try:
                await connection.send_text(payload)
            except Exception as e:
                # Capture closed or dead client socket for immediate cleanup
                stale_connections.append(connection)

        # Cleanup stale/broken connections immediately
        for stale in stale_connections:
            self.remove(stale)


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
            self.redis_client = aioredis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True
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


class WebSocketManager:
    """
    Global Object-Oriented Manager controlling room connection pools across the application.
    Supports multi-node horizontal scaling via Redis Pub/Sub adapters.
    """

    def __init__(self) -> None:
        """Initialize global WebSocket manager with empty room pools map."""
        self._rooms: Dict[int, RoomConnectionPool] = {}
        self.pubsub_manager: RedisPubSubManager = RedisPubSubManager()
        self._listener_tasks: Dict[int, asyncio.Task] = {}

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
                if arena_id in self._rooms:
                    await self._rooms[arena_id].broadcast(data)

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

        # 2. Redis cluster-wide pub/sub broadcast
        if self.pubsub_manager._is_connected:
            channel = f"arena:{arena_id}"
            await self.pubsub_manager.publish(channel, message)

    def get_active_connection_count(self, arena_id: int) -> int:
        """
        Get count of active connections for a given arena.

        :param arena_id: Arena room ID.
        :return: Integer connection count.
        """
        if arena_id in self._rooms:
            return len(self._rooms[arena_id].active_connections)
        return 0


# Global Singleton Instance for WebSocket Manager
websocket_manager = WebSocketManager()
