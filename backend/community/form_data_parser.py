import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger("backend")


def _flatten_querydict_scalars(data: Dict[str, Any], keep_list_keys: set) -> Dict[str, Any]:
    """
    QueryDict → dict 변환 시 스칼라 값이 ['x'] 형태가 될 수 있어 1개짜리 리스트는 스칼라로 평탄화.
    단, keep_list_keys는 리스트를 유지한다.
    """
    for key in list(data.keys()):
        val = data[key]
        if key in keep_list_keys:
            continue
        if isinstance(val, list) and len(val) == 1:
            data[key] = val[0]
    return data


def _parse_json_list(value: Any, field_name: str) -> List[Any]:
    """값이 JSON 문자열(또는 1개짜리 리스트 문자열)이면 list로 파싱."""
    if value is None:
        return []
    if isinstance(value, list):
        if len(value) == 1 and isinstance(value[0], str):
            return _parse_json_list(value[0], field_name)
        # 이미 리스트면 그대로 (form-data가 아닌 경우)
        return value
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("[journal form_data] %s JSON 파싱 실패: %s", field_name, e)
            return []
    return []


def normalize_cooking_journal_request_data(request) -> Dict[str, Any]:
    """
    CookingJournal 생성/수정용 request.data 정규화.
    - multipart/form-data: tags, target_group_ids 같은 배열은 JSON 문자열로 전달될 수 있어 파싱
    - QueryDict 유래 스칼라 값 ['x'] → 'x'
    - FILES(image) 병합
    """
    if hasattr(request.data, "copy"):
        data = request.data.copy()
        if hasattr(data, "lists"):
            data = dict(data)
        else:
            data = dict(data)
    else:
        data = dict(request.data) if request.data else {}

    data = _flatten_querydict_scalars(data, keep_list_keys={"tags", "target_group_ids"})

    files = getattr(request, "FILES", None) or {}
    if "image" not in data and files.get("image"):
        data["image"] = files.get("image")

    # tags: JSON 문자열 또는 콤마 구분 문자열 지원
    if "tags" in data:
        raw = data.get("tags")
        parsed = _parse_json_list(raw, "tags")
        if parsed:
            data["tags"] = [str(x) for x in parsed]
        else:
            if isinstance(raw, str):
                data["tags"] = [s.strip() for s in raw.split(",") if s.strip()]

    # target_group_ids: JSON 배열 문자열 → int 리스트
    if "target_group_ids" in data:
        raw = data.get("target_group_ids")
        parsed = _parse_json_list(raw, "target_group_ids")
        out: List[int] = []
        for x in parsed:
            try:
                out.append(int(x))
            except (TypeError, ValueError):
                continue
        data["target_group_ids"] = out

    return data

