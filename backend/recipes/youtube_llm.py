"""
LLM provider(OpenAI/Gemini)로 유튜브 메타+자막을 레시피 JSON으로 정형화.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

import requests
from django.conf import settings

logger = logging.getLogger("backend")

SYSTEM_PROMPT = """You are a recipe extraction assistant for a Korean recipe web app.
You MUST respond with a single JSON object only, no markdown fences, no extra text.

The JSON must match this structure exactly (keys required):
{
  "title": "string — recipe title in Korean if the source is Korean",
  "description": "string — short summary of the dish (1-3 sentences)",
  "cooking_time": <integer or null> — total cooking time in minutes, estimate if needed,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [
    { "name": "string", "amount": "string — use digits and slash only for fractions e.g. 1/2", "unit": "string or empty string" }
  ],
  "steps": [
    { "step_number": <positive integer starting at 1>, "instruction": "string — one cooking step" }
  ]
}

Rules:
- ingredients: at least 1 item; use reasonable amounts; unit may be empty "".
- steps: at least 1 item; step_number must be sequential 1,2,3,...
- If the video is not a cooking recipe, still produce a plausible minimal recipe JSON from available text or set title/description honestly from context.
- Prefer Korean for title, description, ingredients names, and step instructions when the source is Korean.
"""


def _strip_json_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines)
    return t.strip()


def _parse_llm_json(content: str) -> dict[str, Any]:
    raw = _strip_json_fences(content)
    return json.loads(raw)


def build_user_prompt(*, api_title: str, api_description: str, transcript: str) -> str:
    parts = [
        "=== YouTube video metadata ===",
        f"Title: {api_title}",
        f"Description:\n{api_description or '(empty)'}",
    ]
    if transcript:
        parts.append("=== Transcript (may be partial) ===\n" + transcript)
    else:
        parts.append("=== Transcript ===\n(not available)")
    parts.append(
        "Extract the recipe as JSON following the system schema. "
        "Use transcript + description together when both exist."
    )
    return "\n\n".join(parts)


def parse_recipe_with_llm(*, api_title: str, api_description: str, transcript: str) -> dict[str, Any]:
    provider = str(getattr(settings, "LLM_PROVIDER", "openai") or "openai").strip().lower()
    if provider == "gemini":
        return parse_recipe_with_gemini(
            api_title=api_title,
            api_description=api_description,
            transcript=transcript,
        )
    # default fallback
    return parse_recipe_with_openai(
        api_title=api_title,
        api_description=api_description,
        transcript=transcript,
    )


def parse_recipe_with_openai(*, api_title: str, api_description: str, transcript: str, model: Optional[str] = None) -> dict[str, Any]:
    api_key = getattr(settings, "OPENAI_API_KEY", None) or ""
    if not str(api_key).strip():
        raise RuntimeError("OPENAI_API_KEY가 설정되어 있지 않습니다.")

    model_name = model or getattr(settings, "OPENAI_YOUTUBE_IMPORT_MODEL", "gpt-4o-mini")

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    user_content = build_user_prompt(
        api_title=api_title,
        api_description=api_description,
        transcript=transcript,
    )

    logger.info(
        "OpenAI youtube import | model=%s | desc_len=%s | transcript_len=%s",
        model_name,
        len(api_description or ""),
        len(transcript or ""),
    )

    completion = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
    )
    choice = completion.choices[0].message.content
    if not choice:
        raise RuntimeError("OpenAI 응답이 비어 있습니다.")
    return _normalize_recipe_dict(_parse_llm_json(choice))


def parse_recipe_with_gemini(*, api_title: str, api_description: str, transcript: str, model: Optional[str] = None) -> dict[str, Any]:
    
    api_key = getattr(settings, "GEMINI_API_KEY", None) or ""
    if not str(api_key).strip():
        raise RuntimeError("GEMINI_API_KEY가 설정되어 있지 않습니다.")

    model_name = model or getattr(settings, "GEMINI_YOUTUBE_IMPORT_MODEL", "gemini-1.5-flash")
    user_content = build_user_prompt(
        api_title=api_title,
        api_description=api_description,
        transcript=transcript,
    )

    logger.info(
        "Gemini youtube import | model=%s | desc_len=%s | transcript_len=%s",
        model_name,
        len(api_description or ""),
        len(transcript or ""),
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"text": user_content},
                    {"text": "Return JSON object only."},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    try:
        resp = requests.post(
            url, params={"key": api_key}, headers=headers, json=payload, timeout=60
        )
    except requests.RequestException as e:
        logger.warning("Gemini API 네트워크 오류: %s", type(e).__name__)
        raise RuntimeError("Gemini API 네트워크 오류가 발생했습니다.") from e

    if resp.status_code >= 400:
        body_preview = (resp.text or "").strip()[:400]
        logger.warning(
            "Gemini API 호출 실패 | status=%s | body=%s",
            resp.status_code,
            body_preview,
        )
        raise RuntimeError(
            f"Gemini API 호출 실패: status={resp.status_code}, body={body_preview}"
        )
    try:
        data = resp.json()
    except ValueError as e:
        body_preview = (resp.text or "").strip()[:400]
        logger.warning("Gemini JSON 파싱 실패 | body=%s", body_preview)
        raise RuntimeError("Gemini API 응답 JSON 파싱에 실패했습니다.") from e

    text = ""
    candidates = data.get("candidates") or []
    if candidates:
        parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
        if parts:
            text = str((parts[0] or {}).get("text") or "")
    if not text:
        logger.warning("Gemini 응답 본문이 비어 있음 | keys=%s", list(data.keys()))
        raise RuntimeError("Gemini 응답이 비어 있습니다.")
    return _normalize_recipe_dict(_parse_llm_json(text))


def _normalize_recipe_dict(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    out["title"] = str(data.get("title") or "").strip() or "제목 없음"
    out["description"] = str(data.get("description") or "").strip()

    ct = data.get("cooking_time")
    if ct is None:
        out["cooking_time"] = None
    else:
        try:
            out["cooking_time"] = max(1, int(ct))
        except (TypeError, ValueError):
            out["cooking_time"] = None

    diff = str(data.get("difficulty") or "easy").lower()
    if diff not in ("easy", "medium", "hard"):
        diff = "easy"
    out["difficulty"] = diff

    ingredients_raw = data.get("ingredients") or []
    if not isinstance(ingredients_raw, list):
        ingredients_raw = []
    ingredients: list[dict[str, str]] = []
    for i, item in enumerate(ingredients_raw):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip() or f"재료{i+1}"
        amount = str(item.get("amount") or "1").strip() or "1"
        unit = item.get("unit")
        unit_s = "" if unit is None else str(unit).strip()
        ingredients.append({"name": name, "amount": amount, "unit": unit_s})
    if not ingredients:
        ingredients.append({"name": "재료", "amount": "1", "unit": ""})
    out["ingredients"] = ingredients

    steps_raw = data.get("steps") or []
    if not isinstance(steps_raw, list):
        steps_raw = []
    steps: list[dict[str, Any]] = []
    for idx, item in enumerate(steps_raw):
        if not isinstance(item, dict):
            continue
        sn = item.get("step_number")
        try:
            step_number = int(sn) if sn is not None else idx + 1
        except (TypeError, ValueError):
            step_number = idx + 1
        instr = item.get("instruction") or item.get("description") or ""
        instr = str(instr).strip() or f"단계 {step_number}"
        steps.append({"step_number": step_number, "instruction": instr})
    steps.sort(key=lambda x: x["step_number"])
    for i, s in enumerate(steps):
        s["step_number"] = i + 1
    if not steps:
        steps.append({"step_number": 1, "instruction": "조리 과정을 영상을 참고해 진행합니다."})
    out["steps"] = steps

    return out
