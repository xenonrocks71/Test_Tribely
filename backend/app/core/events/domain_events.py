"""
Domain Event & Event Publisher Architecture (Domain-Driven Design).
Decouples core business logic from notifications, audit logging, and asynchronous side-effects.
"""

from abc import ABC
from typing import Dict, Any, List, Callable, Type
import time


class DomainEvent(ABC):
    """Abstract Base Class for all Domain Events."""

    def __init__(self, aggregate_id: str) -> None:
        self.aggregate_id = aggregate_id
        self.occurred_on: float = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_name": self.__class__.__name__,
            "aggregate_id": self.aggregate_id,
            "occurred_on": self.occurred_on,
        }


class ProofSubmittedEvent(DomainEvent):
    """Fired when a user successfully submits daily habit proof."""

    def __init__(self, submission_id: int, user_id: int, arena_id: int, proof_type: str) -> None:
        super().__init__(aggregate_id=str(submission_id))
        self.submission_id = submission_id
        self.user_id = user_id
        self.arena_id = arena_id
        self.proof_type = proof_type


class ArenaCreatedEvent(DomainEvent):
    """Fired when a new habit arena is created."""

    def __init__(self, arena_id: int, creator_id: int, name: str) -> None:
        super().__init__(aggregate_id=str(arena_id))
        self.arena_id = arena_id
        self.creator_id = creator_id
        self.name = name


class DomainEventPublisher:
    """
    Singleton Publisher managing Domain Event subscriptions and dispatching.
    """

    def __init__(self) -> None:
        self._subscribers: Dict[Type[DomainEvent], List[Callable[[DomainEvent], None]]] = {}

    def subscribe(self, event_type: Type[DomainEvent], handler: Callable[[DomainEvent], None]) -> None:
        """Register an event handler for a specific DomainEvent type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)

    def publish(self, event: DomainEvent) -> None:
        """Dispatch a DomainEvent to all registered handlers."""
        handlers = self._subscribers.get(type(event), [])
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                print(f"[DomainEventPublisher] Handler error on {event.__class__.__name__}: {e}")


# Singleton instance
domain_event_publisher = DomainEventPublisher()
