import signal
import time
import logging
from datetime import datetime

from tracker.db import init_db, close_db, insert_raw_event, update_raw_event_end
from tracker.window_macos import get_active_window

logger = logging.getLogger(__name__)

_running: bool = True
POLL_INTERVAL: int = 5


def _shutdown_handler(signum: int, frame: object) -> None:
    global _running
    logger.info("Received signal %d, shutting down...", signum)
    _running = False


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def _seconds_since(started_at: str) -> int:
    start = datetime.strptime(started_at, "%Y-%m-%dT%H:%M:%S")
    return int((datetime.now() - start).total_seconds())


def poll_tick(state: dict) -> None:
    window = get_active_window()
    current = state["current_event"]

    if window is None:
        state["current_event"] = None
        return

    app_name, window_title = window

    if current is not None and current["app_name"] == app_name and current["window_title"] == window_title:
        now = _now()
        duration = _seconds_since(current["started_at"])
        update_raw_event_end(current["id"], now, duration)
        return

    now = _now()
    row_id = insert_raw_event(
        app_name=app_name,
        window_title=window_title,
        started_at=now,
        ended_at=now,
        duration_sec=0,
    )
    state["current_event"] = {
        "id": row_id,
        "app_name": app_name,
        "window_title": window_title,
        "started_at": now,
    }


def main() -> None:
    global _running
    _running = True

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    signal.signal(signal.SIGTERM, _shutdown_handler)
    signal.signal(signal.SIGINT, _shutdown_handler)

    init_db()
    logger.info("Productivity tracker started")

    state: dict = {"current_event": None}

    try:
        while _running:
            try:
                poll_tick(state)
            except Exception:
                logger.warning("Error in poll tick", exc_info=True)
            time.sleep(POLL_INTERVAL)
    finally:
        state["current_event"] = None
        close_db()
        logger.info("Productivity tracker stopped")


if __name__ == "__main__":
    main()
