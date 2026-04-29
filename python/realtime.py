import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

logger = logging.getLogger(__name__)

_loop: asyncio.AbstractEventLoop | None = None


def set_realtime_loop(loop: asyncio.AbstractEventLoop | None) -> None:
    global _loop
    _loop = loop


class RealtimeConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int | None, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, company_id: int | None) -> None:
        await websocket.accept()
        self._connections[company_id].add(websocket)

    def disconnect(self, websocket: WebSocket, company_id: int | None) -> None:
        self._connections[company_id].discard(websocket)
        if not self._connections[company_id]:
            self._connections.pop(company_id, None)

    async def broadcast(self, payload: dict[str, Any], company_id: int | None = None) -> None:
        targets = set(self._connections.get(None, set()))
        if company_id is not None:
            targets.update(self._connections.get(company_id, set()))

        stale: list[tuple[WebSocket, int | None]] = []
        for websocket in targets:
            try:
                await websocket.send_json(jsonable_encoder(payload))
            except Exception:
                for key, sockets in self._connections.items():
                    if websocket in sockets:
                        stale.append((websocket, key))

        for websocket, key in stale:
            self.disconnect(websocket, key)


manager = RealtimeConnectionManager()


def publish_realtime_event(payload: dict[str, Any], company_id: int | None = None) -> None:
    if _loop is None or _loop.is_closed():
        return
    try:
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload, company_id), _loop)
    except Exception:
        logger.exception("Unable to publish realtime event")
