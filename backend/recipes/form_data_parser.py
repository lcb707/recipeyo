# recipes/form_data_parser.py
"""
multipart/form-data 요청 시 레시피 생성·수정용 request.data 정규화.
- ingredients, steps 가 JSON 문자열이면 파싱해 리스트로 변환.
- request.FILES 의 step_image_0, step_image_1, ... 를 steps[i].image 에 매핑.
- thumbnail_image 가 FILES에만 있으면 data 에 병합.
docs/RECIPE_STEP_IMAGES_API_DESIGN.md 권장안 반영.
"""
import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger("backend")


def _parse_json_list(value: Any, field_name: str) -> List[Dict[str, Any]]:
    """값이 문자열이면 JSON 배열로 파싱. 리스트이고 길이 1인 문자열이면 그 요소를 파싱."""
    if value is None:
        return []
    # QueryDict 유래: ['[{"name":"김치",...}]'] 형태면 첫 요소 문자열을 JSON 파싱
    if isinstance(value, list):
        if len(value) == 1 and isinstance(value[0], str):
            return _parse_json_list(value[0], field_name)
        if len(value) == 0:
            return []
        # 이미 dict 리스트면 그대로 (JSON body 유래)
        if all(isinstance(x, dict) for x in value):
            return value
        return []
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        try:
            parsed = json.loads(value)
            if not isinstance(parsed, list):
                return []
            return parsed
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("[recipe form_data] %s JSON 파싱 실패: %s", field_name, e)
            return []
    return []


def normalize_recipe_request_data(request) -> Dict[str, Any]:
    """
    request.data + request.FILES 를 합쳐 레시피 시리얼라이저에 넘길 수 있는 dict 생성.
    - application/json: data 그대로 사용, FILES 의 step_image_N 은 steps 에 병합.
    - multipart/form-data: ingredients/steps 문자열 → JSON 파싱, step_image_0,1,... → steps[i].image.
    """
    # request.data 가 QueryDict 이면 mutable dict 로 복사
    if hasattr(request.data, "copy"):
        data = request.data.copy()
        if hasattr(data, "lists"):
            data = dict(data)
        else:
            data = dict(data)
    else:
        data = dict(request.data) if request.data else {}

    # QueryDict 유래: 값이 길이 1인 리스트면 스칼라로 풀기 (title, cooking_time 등)
    for key in list(data.keys()):
        val = data[key]
        if isinstance(val, list) and len(val) == 1 and key not in ("ingredients", "recipe_ingredients", "steps", "recipe_steps"):
            data[key] = val[0]

    # category_ids: form-data에서 JSON 문자열로 올 수 있음 (예: "[1,2]")
    if "category_ids" in data and isinstance(data.get("category_ids"), str):
        raw = data.get("category_ids")
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                data["category_ids"] = parsed
        except (json.JSONDecodeError, TypeError):
            pass

    # FILES 에 있는 thumbnail_image 를 data 에 반영 (form-data 에서만 올 수 있음)
    files = getattr(request, "FILES", None) or {}
    if "thumbnail_image" not in data and files.get("thumbnail_image"):
        data["thumbnail_image"] = files.get("thumbnail_image")

    # ingredients: 전달된 경우에만 파싱 (partial update 시 미전달이면 기존 유지)
    ingredients_raw = data.get("ingredients", data.get("recipe_ingredients"))
    if ingredients_raw is not None:
        ingredients = _parse_json_list(ingredients_raw, "ingredients")
        data["ingredients"] = ingredients
        data["recipe_ingredients"] = ingredients

    # steps: 전달된 경우 또는 step_image_N 이 있는 경우에만 파싱·매핑
    steps_raw = data.get("steps", data.get("recipe_steps"))
    has_step_files = any(f"step_image_{i}" in files for i in range(100))
    if steps_raw is not None or has_step_files:
        steps = _parse_json_list(steps_raw, "steps") if steps_raw is not None else []
        # step_image_0, step_image_1, ... 를 steps[i].image 에 할당
        for i in range(len(steps)):
            if not isinstance(steps[i], dict):
                steps[i] = {}
            step_file_key = f"step_image_{i}"
            if step_file_key in files and files[step_file_key]:
                steps[i]["image"] = files.get(step_file_key)
        data["steps"] = steps
        data["recipe_steps"] = steps
    return data
