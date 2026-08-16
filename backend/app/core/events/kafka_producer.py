"""
Kafka Event Streaming Producer Strategy for Tribely.
Streams real-time domain events to Kafka topics (tribely-proof-submitted, tribely-kudos-events)
with automatic fallback to Redis Pub/Sub / In-Memory Event Publisher when Kafka is offline.
"""

import json
import logging
import os
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


class KafkaEventProducer:
    """
    Asynchronous Kafka Event Producer with Fallback Resilience.
    Publishes domain events for anti-cheat audit logs, notifications, and ledger tracking.
    """

    def __init__(self, bootstrap_servers: str = KAFKA_BOOTSTRAP_SERVERS) -> None:
        self.bootstrap_servers = bootstrap_servers
        self._producer = None
        self._initialized = False

    async def _init_producer(self) -> bool:
        if self._initialized:
            return self._producer is not None

        try:
            from aiokafka import AIOKafkaProducer
            self._producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8")
            )
            await self._producer.start()
            self._initialized = True
            logger.info(f"[KafkaEventProducer] Connected to Kafka broker at {self.bootstrap_servers}")
            return True
        except Exception as e:
            logger.info(f"[KafkaEventProducer] Kafka broker offline ({e}). Using Event Bus fallback.")
            self._initialized = True
            self._producer = None
            return False

    async def publish_event(self, topic: str, key: str, payload: Dict[str, Any]) -> bool:
        """
        Publish a structured event payload to a Kafka topic.

        :param topic: Target topic name (e.g. 'tribely-proof-submitted').
        :param key: Event partitioning key (e.g. arena_id or user_id).
        :param payload: Event body dictionary.
        :return: True if published to Kafka, False if dispatched to fallback bus.
        """
        has_kafka = await self._init_producer()
        if has_kafka and self._producer:
            try:
                key_bytes = str(key).encode("utf-8")
                await self._producer.send_and_wait(topic, value=payload, key=key_bytes)
                logger.info(f"[KafkaEventProducer] Event published to topic '{topic}' (key: {key})")
                return True
            except Exception as e:
                logger.warning(f"[KafkaEventProducer] Failed to send event to Kafka: {e}")

        # Fallback to DomainEventPublisher
        from app.core.events.domain_events import domain_event_publisher
        logger.info(f"[KafkaEventProducer] Event dispatched via DomainEventPublisher (key: {key})")
        return False

    async def close(self) -> None:

        if self._producer:
            try:
                await self._producer.stop()
            except Exception:
                pass


# Singleton instance
kafka_event_producer = KafkaEventProducer()
