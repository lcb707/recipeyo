from __future__ import annotations

from typing import Any, Optional

from rest_framework import serializers


def get_image_url(request, url: Optional[str]) -> Optional[str]:
    """
    이미지 URL 공통 변환기.

    - 현재(기본): 절대 경로 반환 (request.build_absolute_uri)
    - 추후 전환: 상대 경로 반환 (아래 주석 처리된 라인으로 스위치)
    """
    if not url:
        return None
    # --- Future switch (relative URL) ---
    # return url

    if request is None:
        return url
    return request.build_absolute_uri(url)


class AbsoluteImageField(serializers.ImageField):
    """
    모든 Serializer에서 공통으로 사용하는 이미지 출력 Field.
    request가 context에 있으면 절대 URL로 반환.
    """

    def to_representation(self, value: Any) -> Optional[str]:
        rep = super().to_representation(value)
        request = self.context.get("request") if hasattr(self, "context") else None
        return get_image_url(request, rep)

