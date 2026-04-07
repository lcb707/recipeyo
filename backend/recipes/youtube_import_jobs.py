"""
유튜브 임포트 비동기 작업 상태 (django.core.cache / Redis 권장).
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Dict, Optional

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger("backend")

PREFIX = "youtube_import_job:"
DEFAULT_TTL = 60 * 60  # 1시간


def _now_iso() -> str:
    return timezone.now().isoformat()


def create_job(user_id: int, ttl: int = DEFAULT_TTL) -> str:
    job_id = str(uuid.uuid4())
    payload: Dict[str, Any] = {
        "status": "pending",
        "user_id": user_id,
        "recipe_id": None,
        "message": "",
        "error_message": "",
        "updated_at": _now_iso(),
    }
    cache.set(PREFIX + job_id, json.dumps(payload), ttl)
    logger.info("youtube_import job created | job_id=%s | user_id=%s", job_id, user_id)
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    raw = cache.get(PREFIX + job_id)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def update_job(job_id: str, ttl: int = DEFAULT_TTL, **kwargs: Any) -> bool:
    data = get_job(job_id)
    if data is None:
        return False
    data.update(kwargs)
    data["updated_at"] = _now_iso()
    cache.set(PREFIX + job_id, json.dumps(data), ttl)
    return True
