"""
유튜브 LLM 임포트용 재료 amount 정규화.
수동 레시피 API(RecipeIngredientSerializer)는 숫자·'/' 만 허용하므로 동일 규칙에 맞춘다.
"""
from __future__ import annotations

import re

AMOUNT_PATTERN = re.compile(r"^[0-9/]+$")


def sanitize_youtube_ingredient_amount(amount) -> str:
    """
    LLM이 반환한 문자열에서 0-9 및 '/' 만 남긴다.
    비어 있거나 규칙에 맞지 않으면 '1'.
    """
    s = str(amount or "").strip()
    if not s:
        return "1"
    cleaned = "".join(c for c in s if c.isdigit() or c == "/")
    if not cleaned or AMOUNT_PATTERN.fullmatch(cleaned) is None:
        return "1"
    return cleaned
