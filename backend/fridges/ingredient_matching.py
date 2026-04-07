"""
레시피 재료명 ↔ 표준 식재료명 매칭 유틸.

- 정규화(NFKC, 공백, 괄호 부가 설명 제거)
- StandardIngredient.name + search_keywords(쉼표 구분) 확장
- DB 필터용 Q: iexact + (길이 2 이상일 때) icontains
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

from django.db.models import Q

from .models import StandardIngredient

# 짧은 문자열 icontains는 오탐 위험이 있어 최소 길이 제한
_MIN_ICONTAINS_LEN = 2


def normalize_ingredient_name(value: str | None) -> str:
    """표시용 재료명을 비교 가능한 형태로 정규화."""
    if not value:
        return ""
    t = unicodedata.normalize("NFKC", str(value)).strip()
    t = re.sub(r"\s+", " ", t)
    # 괄호 안 부가 설명 제거: "양파(중)" → "양파"
    t = re.sub(r"\([^)]*\)", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def expand_standard_ingredient_terms(si: StandardIngredient) -> list[str]:
    """표준 식재료의 기본명 + search_keywords를 정규화한 문자열 목록."""
    out: list[str] = []
    n = normalize_ingredient_name(si.name)
    if n:
        out.append(n)
    raw_kw = (si.search_keywords or "").strip()
    if raw_kw:
        for part in raw_kw.split(","):
            p = normalize_ingredient_name(part)
            if p and p not in out:
                out.append(p)
    return out


def collect_terms_from_standard_ingredients(
    ingredient_ids: Iterable[int],
) -> tuple[list[str], list[int]]:
    """
    표준 식재료 ID 목록으로부터 매칭용 용어 목록과 실제 조회된 ID 목록 반환.
    존재하지 않는 ID는 무시.
    """
    ids = [int(x) for x in ingredient_ids if x is not None]
    if not ids:
        return [], []
    qs = StandardIngredient.objects.filter(pk__in=ids).only(
        "id", "name", "search_keywords"
    )
    found_ids: list[int] = []
    terms: list[str] = []
    seen: set[str] = set()
    for si in qs.order_by("id"):
        found_ids.append(si.id)
        for t in expand_standard_ingredient_terms(si):
            if t and t not in seen:
                seen.add(t)
                terms.append(t)
    return terms, found_ids


def collect_terms_from_free_text(names: Iterable[str]) -> list[str]:
    """사용자 입력 문자열(레거시 selected_ingredients)만으로 용어 수집."""
    terms: list[str] = []
    seen: set[str] = set()
    for raw in names:
        t = normalize_ingredient_name(raw)
        if t and t not in seen:
            seen.add(t)
            terms.append(t)
    return terms


def collect_terms_from_fridge_item_names(names: Iterable[str]) -> list[str]:
    """냉장고 FridgeItem.name 목록을 매칭 용어로 변환 (표준 재료 조회 없음)."""
    return collect_terms_from_free_text(names)


def build_recipe_ingredient_match_q(terms: Iterable[str]) -> Q:
    """
    Recipe 쿼리셋에 사용할 recipe_ingredients 조건 Q.

    - 각 용어에 대해 name__iexact
    - 길이 >= _MIN_ICONTAINS_LEN 이면 name__icontains 추가 (괄호 표기 등 흡수)
    terms가 비이면 항상 False인 Q.
    """
    q = Q()
    seen: set[str] = set()
    for raw in terms:
        t = normalize_ingredient_name(raw)
        if not t or t in seen:
            continue
        seen.add(t)
        q |= Q(recipe_ingredients__name__iexact=t)
        if len(t) >= _MIN_ICONTAINS_LEN:
            q |= Q(recipe_ingredients__name__icontains=t)
    if not q:
        return Q(pk__in=[])
    return q


def build_recipe_ingredient_match_q_for_count(terms: Iterable[str]) -> Q:
    """
    Recipe 쿼리셋에 annotate(Count('recipe_ingredients', filter=...)) 할 때 사용.

    filter 내부 Q는 **Recipe** 기준으로 resolve 되므로 재료명은
    ``recipe_ingredients__name`` 으로 지정해야 한다 (bare ``name`` 은 Recipe에 없어 FieldError).
    """
    q = Q()
    seen: set[str] = set()
    for raw in terms:
        t = normalize_ingredient_name(raw)
        if not t or t in seen:
            continue
        seen.add(t)
        q |= Q(recipe_ingredients__name__iexact=t)
        if len(t) >= _MIN_ICONTAINS_LEN:
            q |= Q(recipe_ingredients__name__icontains=t)
    if not q:
        return Q(pk__in=[])
    return q


def recipe_line_matches_any_term(recipe_raw: str, terms: list[str]) -> bool:
    """
    레시피 재료 한 줄(`RecipeIngredient.name`)이 용어 목록에 매칭되는지.
    `build_recipe_ingredient_match_q` 와 동일 규칙(정규화 후 iexact / icontains).
    관리 명령·검증 스크립트에서 DB 없이 동일 판정을 맞추기 위해 사용.
    """
    r = normalize_ingredient_name(recipe_raw)
    if not r:
        return False
    for t in terms:
        if not t:
            continue
        if r == t:
            return True
        if len(t) >= _MIN_ICONTAINS_LEN and t in r:
            return True
    return False


def pick_standards_by_substring_overlap(
    recipe_normalized: str,
    standards: list[StandardIngredient],
) -> list[StandardIngredient]:
    """
    아직 어떤 표준 용어에도 안 걸리는 레시피 재료명에 대해,
    표준 식재료 `name` 정규화 문자열과의 부분 포함 관계로 후보 표준을 고른다.
    (긴 이름 우선 — 더 구체적인 표준에 붙이기 위함)
    """
    r = recipe_normalized
    if not r or len(r) < 2:
        return []
    scored: list[tuple[int, StandardIngredient]] = []
    for si in standards:
        sn = normalize_ingredient_name(si.name)
        if not sn or len(sn) < 2:
            continue
        if sn in r or r in sn:
            scored.append((len(sn), si))
    scored.sort(key=lambda x: -x[0])
    return [x[1] for x in scored]


def merge_search_keywords_field(
    existing: str | None, additions: Iterable[str], max_length: int = 255
) -> str:
    """쉼표 구분 search_keywords에 항목을 합치고 중복·공백을 제거한다."""
    parts: list[str] = []
    seen: set[str] = set()
    for chunk in (existing or "").split(","):
        t = chunk.strip()
        if t and t not in seen:
            seen.add(t)
            parts.append(t)
    for a in additions:
        t = str(a).strip()
        if t and t not in seen:
            seen.add(t)
            parts.append(t)
    out = ", ".join(parts)
    if len(out) > max_length:
        out = out[:max_length].rsplit(",", 1)[0].strip()
    return out
