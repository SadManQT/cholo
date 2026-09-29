"""The interface every platform backend implements."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from ..engine import World
    from ..messages import Command, Event


class Backend(Protocol):
    name: str
    #: True when the backend talks to a real server and must run in wall-clock time.
    realtime: bool

    async def start(self, world: "World") -> None: ...

    def submit(self, command: "Command") -> None: ...

    def drain(self) -> list["Event"]: ...

    def step(self, now_s: float) -> None: ...

    def stats(self) -> dict: ...

    async def close(self) -> None: ...
