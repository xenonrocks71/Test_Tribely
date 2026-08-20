"""
High-Performance Chat Caching & Metadata Service.
Provides sub-millisecond Redis caching for Arena chat history, transactions, and user metadata,
decoupling real-time WebSocket broadcasts from blocking database transactions.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from app.core.config import settings

class ChatCacheService:
    def __init__(self):
        self._redis_client = None
        self._local_user_cache: Dict[int, Dict[str, Any]] = {}
        self._local_chat_history: Dict[int, List[Dict[str, Any]]] = {}
        self._local_transaction_history: Dict[int, List[Dict[str, Any]]] = {}

    def _get_redis(self):
        if self._redis_client is None:
            try:
                import redis
                if settings.REDIS_URL:
                    self._redis_client = redis.Redis.from_url(
                        settings.REDIS_URL,
                        decode_responses=True,
                        socket_timeout=2.0,
                        socket_connect_timeout=2.0,
                        retry_on_timeout=True
                    )
                else:
                    self._redis_client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        password=settings.REDIS_PASSWORD,
                        decode_responses=True,
                        socket_timeout=2.0,
                        socket_connect_timeout=2.0,
                        retry_on_timeout=True
                    )
                self._redis_client.ping()
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis init notice (fallback to high-speed in-memory buffer): {e}")
                self._redis_client = False
        return self._redis_client if self._redis_client is not False else None

    def cache_user_meta(self, user_id: int, full_name: str, avatar_url: Optional[str]) -> None:
        """Cache user display metadata for instant 0ms retrieval."""
        meta = {
            "full_name": full_name or f"Member #{user_id}",
            "avatar_url": avatar_url or ""
        }
        self._local_user_cache[user_id] = meta

        redis_c = self._get_redis()
        if redis_c:
            try:
                redis_c.setex(f"user_meta:{user_id}", 86400, json.dumps(meta))
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis set user meta notice: {e}")

    def get_user_meta(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve cached user metadata without hitting SQL database."""
        if user_id in self._local_user_cache:
            return self._local_user_cache[user_id]

        redis_c = self._get_redis()
        if redis_c:
            try:
                raw = redis_c.get(f"user_meta:{user_id}")
                if raw:
                    meta = json.loads(raw)
                    self._local_user_cache[user_id] = meta
                    return meta
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis get user meta notice: {e}")
        return None

    def push_recent_message(self, arena_id: int, message_data: Dict[str, Any]) -> None:
        """Push message to Redis recent list (capped at 100 entries)."""
        if arena_id not in self._local_chat_history:
            self._local_chat_history[arena_id] = []
        self._local_chat_history[arena_id].insert(0, message_data)
        if len(self._local_chat_history[arena_id]) > 100:
            self._local_chat_history[arena_id] = self._local_chat_history[arena_id][:100]

        redis_c = self._get_redis()
        if redis_c:
            try:
                key = f"arena_chat:{arena_id}"
                redis_c.lpush(key, json.dumps(message_data))
                redis_c.ltrim(key, 0, 99)
                redis_c.expire(key, 604800)  # 7 days retention
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis lpush message notice: {e}")

    def get_recent_messages(self, arena_id: int, limit: int = 50) -> Optional[List[Dict[str, Any]]]:
        """Fetch recent messages directly from Redis cache."""
        redis_c = self._get_redis()
        if redis_c:
            try:
                key = f"arena_chat:{arena_id}"
                raw_list = redis_c.lrange(key, 0, limit - 1)
                if raw_list:
                    return [json.loads(item) for item in raw_list]
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis lrange messages notice: {e}")

        if arena_id in self._local_chat_history and self._local_chat_history[arena_id]:
            return self._local_chat_history[arena_id][:limit]
        return None

    def push_recent_transaction(self, arena_id: int, transaction_data: Dict[str, Any]) -> None:
        """Push ledger / penalty transaction to Redis recent list (capped at 50 entries)."""
        if arena_id not in self._local_transaction_history:
            self._local_transaction_history[arena_id] = []
        self._local_transaction_history[arena_id].insert(0, transaction_data)
        if len(self._local_transaction_history[arena_id]) > 50:
            self._local_transaction_history[arena_id] = self._local_transaction_history[arena_id][:50]

        redis_c = self._get_redis()
        if redis_c:
            try:
                key = f"arena_tx:{arena_id}"
                redis_c.lpush(key, json.dumps(transaction_data))
                redis_c.ltrim(key, 0, 49)
                redis_c.expire(key, 604800)
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis lpush transaction notice: {e}")

    def get_recent_transactions(self, arena_id: int, limit: int = 20) -> Optional[List[Dict[str, Any]]]:
        """Fetch recent transactions directly from Redis cache."""
        redis_c = self._get_redis()
        if redis_c:
            try:
                key = f"arena_tx:{arena_id}"
                raw_list = redis_c.lrange(key, 0, limit - 1)
                if raw_list:
                    return [json.loads(item) for item in raw_list]
            except Exception as e:
                logging.debug(f"[ChatCacheService] Redis lrange transactions notice: {e}")

        if arena_id in self._local_transaction_history and self._local_transaction_history[arena_id]:
            return self._local_transaction_history[arena_id][:limit]
        return None

chat_cache_service = ChatCacheService()
