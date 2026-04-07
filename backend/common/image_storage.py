# common/image_storage.py
"""
이미지 업로드 공용 처리 (docs/IMAGE_STORAGE_SPEC.md 기준).
- 저장 루트: MEDIA_ROOT (outgoing)
- 파일명: 서버 생성 고유값(UUID). 사용자 파일명 미사용.
- 유효성: MIME, 확장자, 용량 검사.
"""
import os
import uuid
import logging
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.core.files.storage import default_storage

from .exceptions import BusinessLogicException
from .response_code import ResponseCode

logger = logging.getLogger("backend")

# 허용 이미지 확장자 (소문자)
ALLOWED_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

# 허용 MIME 타입 (실제 바이트 검사는 별도, 여기서는 content_type 검사용)
ALLOWED_MIME_TYPES = frozenset({
    "image/jpeg",
    "image/png",
    "image/webp",
})

# 최대 파일 크기 (5MB)
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

# JPEG 매직 바이트
JPEG_MAGIC = (b"\xff\xd8\xff",)
PNG_MAGIC = (b"\x89PNG\r\n\x1a\n",)
WEBP_MAGIC = (b"RIFF",)  # WEBP는 RIFF....WEBP 형태


def _get_extension_from_name(name: str) -> str:
    """파일명에서 확장자 추출 (소문자, 점 포함)."""
    _, ext = os.path.splitext(name or "")
    return (ext or "").lower()


def _safe_subpath(subpath: str) -> str:
    """상대 경로에서 상위 디렉터리 참조(../) 제거 및 정규화."""
    if not subpath or not isinstance(subpath, str):
        return ""
    # 슬래시 정규화 후 상위 참조 제거
    parts = [p for p in subpath.replace("\\", "/").split("/") if p and p != ".."]
    return "/".join(parts)


def _validate_extension(ext: str) -> None:
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise BusinessLogicException(
            f"허용되지 않은 이미지 확장자입니다. 사용 가능: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )


def _validate_content_type(content_type: str) -> None:
    if not content_type:
        raise BusinessLogicException(
            "파일 형식을 확인할 수 없습니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )
    main = content_type.split(";")[0].strip().lower()
    if main not in ALLOWED_MIME_TYPES:
        raise BusinessLogicException(
            "허용되지 않은 이미지 형식입니다. (jpeg, png, webp만 가능)",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )


def _validate_size(size: int) -> None:
    if size is None or size <= 0:
        raise BusinessLogicException(
            "파일 크기를 확인할 수 없습니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )
    if size > MAX_IMAGE_SIZE_BYTES:
        raise BusinessLogicException(
            f"파일 크기가 제한({MAX_IMAGE_SIZE_BYTES // (1024*1024)}MB)을 초과합니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )


def _validate_magic_bytes(data: bytes, ext: str) -> None:
    """업로드 파일 앞부분 매직 바이트로 실제 이미지 여부 확인."""
    if len(data) < 12:
        raise BusinessLogicException(
            "파일 내용이 비어있거나 손상되었습니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )
    ext_lower = ext.lower()
    if ext_lower in (".jpg", ".jpeg"):
        if not any(data.startswith(m) for m in JPEG_MAGIC):
            raise BusinessLogicException("파일 내용이 JPEG 형식이 아닙니다.", error_code=ResponseCode.ErrorCode.InputAreaInvalid)
    elif ext_lower == ".png":
        if not data.startswith(PNG_MAGIC[0]):
            raise BusinessLogicException("파일 내용이 PNG 형식이 아닙니다.", error_code=ResponseCode.ErrorCode.InputAreaInvalid)
    elif ext_lower == ".webp":
        if not (data.startswith(WEBP_MAGIC[0]) and b"WEBP" in data[:12]):
            raise BusinessLogicException("파일 내용이 WEBP 형식이 아닙니다.", error_code=ResponseCode.ErrorCode.InputAreaInvalid)


def validate_image_file(uploaded_file: UploadedFile) -> None:
    """
    업로드된 파일이 허용된 이미지인지 검사.
    - 확장자, MIME, 용량, 매직 바이트 검사.
    검증 실패 시 BusinessLogicException 발생.
    """
    if not uploaded_file:
        raise BusinessLogicException("업로드된 파일이 없습니다.", error_code=ResponseCode.ErrorCode.InputAreaInvalid)
    name = getattr(uploaded_file, "name", None) or ""
    ext = _get_extension_from_name(name)
    _validate_extension(ext)

    content_type = getattr(uploaded_file, "content_type", None) or ""
    _validate_content_type(content_type)

    size = getattr(uploaded_file, "size", None)
    if size is None and hasattr(uploaded_file, "file"):
        uploaded_file.seek(0, 2)
        size = uploaded_file.tell()
        uploaded_file.seek(0)
    _validate_size(size)

    # 매직 바이트 검사 (앞 12바이트)
    if hasattr(uploaded_file, "read"):
        uploaded_file.seek(0)
        head = uploaded_file.read(12)
        uploaded_file.seek(0)
        _validate_magic_bytes(head, ext)


def get_unique_filename(extension: str) -> str:
    """저장용 고유 파일명 생성. extension은 점 포함 (예: .jpg)."""
    ext = (extension or "").lower()
    if ext and not ext.startswith("."):
        ext = "." + ext
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        ext = ".jpg"
    return f"{uuid.uuid4().hex}{ext}"


def save_uploaded_image(uploaded_file: UploadedFile, subpath: str) -> str:
    """
    업로드된 이미지를 검증 후 MEDIA_ROOT(outgoing) 아래 subpath에 저장하고,
    DB/API에서 사용할 상대 경로(MEDIA_ROOT 기준)를 반환.

    - subpath: 예 'recipes/thumbnails', 'recipes/steps', 'community/journals', 'users/profiles'
    - 반환값: 예 'recipes/thumbnails/abc123.jpg' (MEDIA_URL과 붙이면 /media/recipes/thumbnails/abc123.jpg)

    검증 실패 시 BusinessLogicException. 저장 실패 시 로그 후 예외 전파.
    """
    validate_image_file(uploaded_file)
    safe_path = _safe_subpath(subpath)
    if not safe_path:
        raise BusinessLogicException(
            "저장 경로가 올바르지 않습니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )
    ext = _get_extension_from_name(getattr(uploaded_file, "name", "") or "")
    if not ext:
        ext = ".jpg"
    filename = get_unique_filename(ext)
    relative_path = f"{safe_path}/{filename}"

    try:
        # default_storage 사용 시 MEDIA_ROOT에 저장 (로컬), 추후 S3 등으로 교체 가능
        default_storage.save(relative_path, uploaded_file)
        return relative_path
    except Exception as e:
        logger.exception("이미지 저장 실패: path=%s error=%s", relative_path, e)
        raise BusinessLogicException(
            "이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
            error_code=ResponseCode.ErrorCode.ServerError,
        )
