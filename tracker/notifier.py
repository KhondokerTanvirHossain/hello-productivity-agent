import logging
import subprocess

logger = logging.getLogger(__name__)

REVIEW_URL: str = "http://localhost:5173/review"


def send_eod_notification() -> bool:
    try:
        subprocess.run(
            [
                "osascript",
                "-e",
                'display notification "Time to review your day!" with title "Productivity Tracker"',
            ],
            check=False,
        )
        subprocess.run(["open", REVIEW_URL], check=False)
        return True
    except Exception:
        logger.warning("Failed to send EOD notification", exc_info=True)
        return False
