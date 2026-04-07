"""
공통 페이지네이션 유틸. 목록 API 응답을 { count, next, previous, results } 형식으로 통일.
"""
from typing import Any, Dict, List, Optional

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def get_page_params(request, default_size: int = DEFAULT_PAGE_SIZE) -> tuple:
    """request에서 page, page_size 추출. (page 1-based, page_size 기본 20, 최대 100)."""
    try:
        page = int(request.query_params.get("page", 1))
        page = max(1, page)
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.query_params.get("page_size", default_size))
        page_size = max(1, min(MAX_PAGE_SIZE, page_size))
    except (TypeError, ValueError):
        page_size = default_size
    return page, page_size


def paginate_queryset(queryset, page: int, page_size: int):
    """Queryset을 slice하여 해당 페이지 구간 반환. (0-based offset)"""
    offset = (page - 1) * page_size
    return queryset[offset : offset + page_size]


def build_paginated_response(
    request,
    queryset,
    page: int,
    page_size: int,
    serialized_results: List[Any],
    base_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    count, next, previous, results 를 담은 dict 반환.
    base_path: next/previous URL에 사용할 경로(쿼리 제외). None이면 request.path 사용.
    """
    count = queryset.count() if hasattr(queryset, "count") else len(queryset)
    total_pages = (count + page_size - 1) // page_size if page_size else 0

    base = base_path or request.path
    if not base.endswith("/"):
        base = base + "/"
    # 쿼리 파라미터 유지 (page, page_size 제외하고 나머지 붙이기)
    params = request.GET.copy()
    if "page" in params:
        params.pop("page")
    if "page_size" in params:
        params.pop("page_size")
    query_string = params.urlencode()

    def url_for(p: int) -> str:
        if query_string:
            return request.build_absolute_uri(f"{base}?page={p}&{query_string}")
        return request.build_absolute_uri(f"{base}?page={p}")

    next_url = url_for(page + 1) if page < total_pages else None
    previous_url = url_for(page - 1) if page > 1 else None

    return {
        "count": count,
        "next": next_url,
        "previous": previous_url,
        "results": serialized_results,
    }
