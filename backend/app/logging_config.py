"""
Structured logging for the API. Use get_logger(__name__) in modules.
In production, uses a JSON-like formatter for log aggregation.
"""
import json
import logging
import sys
from datetime import datetime, timezone

from app.config.settings import settings

_IS_PROD = (settings.ENVIRONMENT or "").strip().lower() in ("production", "prod")


class JsonFormatter(logging.Formatter):
    """Format log records as one JSON object per line for production aggregation."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    """Configure root logger and level. Call once at app startup."""
    level = logging.INFO if _IS_PROD else logging.DEBUG
    root = logging.getLogger()
    root.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    if _IS_PROD:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )
    if root.handlers:
        root.handlers.clear()
    root.addHandler(handler)
    # Reduce noise from third-party libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a logger for the given module name."""
    return logging.getLogger(name)
