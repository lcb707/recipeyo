"""
유튜브 URL에서 video_id·메타데이터·(가능 시) 자막을 추출한다.

우선순위:
1) ``YOUTUBE_API_KEY`` 가 있으면 YouTube Data API v3 (google-api-python-client) — 안정적
2) 없으면 ``yt-dlp`` 로 메타데이터 추출 (API 키 불필요, 유지보수 활발)

자막: ``youtube-transcript-api`` (공개 자막이 있을 때만).
"""
from __future__ import annotations

import logging
import re
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger("backend")

# 일반적인 유튜브 URL에서 11자 video id
_VIDEO_ID_PATTERN = re.compile(
    r"(?:youtube\.com/(?:watch\?(?:[^&\s]+&)*v=|embed/|shorts/)|youtu\.be/)([0-9A-Za-z_-]{11})"
)
_ALLOWED_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
}


def _parse_iso8601_duration_to_seconds(duration: str) -> Optional[int]:
    # Examples: PT15M33S, PT1H2M, PT45S
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", str(duration or ""))
    if not m:
        return None
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    seconds = int(m.group(3) or 0)
    return (hours * 3600) + (minutes * 60) + seconds


def normalize_and_validate_youtube_url(url: str) -> str:
    """
    SSRF 방어를 위해 유튜브 도메인만 허용하고 https 스킴을 강제한다.
    """
    if not url or not isinstance(url, str):
        raise ValueError("지원하지 않는 YouTube URL 형식입니다.")
    s = url.strip()
    parsed = urlparse(s)

    if parsed.scheme.lower() != "https":
        raise ValueError("YouTube URL은 https만 허용됩니다.")

    if parsed.username or parsed.password:
        raise ValueError("인증정보가 포함된 URL은 허용되지 않습니다.")

    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_YOUTUBE_HOSTS:
        raise ValueError("지원하는 YouTube 도메인만 허용됩니다.")

    if parsed.port not in (None, 443):
        raise ValueError("허용되지 않는 포트입니다.")

    return s


def parse_youtube_video_id(url: str) -> Optional[str]:
    """URL 문자열에서 11자 video_id를 추출. 실패 시 None."""
    if not url or not isinstance(url, str):
        return None
    s = url.strip()
    m = _VIDEO_ID_PATTERN.search(s)
    if m:
        return m.group(1)
    # 일부 앱/리다이렉트: v= 단독
    try:
        parsed = urlparse(s)
        if "youtube.com" in (parsed.netloc or ""):
            q = parse_qs(parsed.query)
            v = q.get("v", [None])[0]
            if v and re.fullmatch(r"[0-9A-Za-z_-]{11}", v):
                return v
    except Exception:
        pass
    return None


def _pick_thumbnail_url_from_api_snippet(snippet_thumbnails: dict[str, Any]) -> Optional[str]:
    """YouTube API snippet.thumbnails 에서 고해상도 우선 URL."""
    if not snippet_thumbnails:
        return None
    for key in ("maxres", "standard", "high", "medium", "default"):
        t = snippet_thumbnails.get(key)
        if isinstance(t, dict) and t.get("url"):
            return t["url"]
    return None


def fetch_metadata_google_api(video_id: str, api_key: str) -> dict[str, Any]:
    """YouTube Data API v3: 제목, 설명, 썸네일 URL, 길이(초)."""
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    youtube = build("youtube", "v3", developerKey=api_key, cache_discovery=False)
    try:
        res = youtube.videos().list(part="snippet,contentDetails", id=video_id).execute()
    except HttpError as e:
        logger.warning("YouTube API HttpError: %s", e)
        raise RuntimeError("YouTube Data API 호출에 실패했습니다.") from e
    items = res.get("items") or []
    if not items:
        raise RuntimeError("해당 video_id의 영상을 찾을 수 없습니다.")
    sn = items[0].get("snippet") or {}
    cd = items[0].get("contentDetails") or {}
    thumbs = sn.get("thumbnails") or {}
    thumb_url = _pick_thumbnail_url_from_api_snippet(thumbs)
    duration_seconds = None
    duration_seconds = _parse_iso8601_duration_to_seconds(cd.get("duration", ""))
    # Data API 쿼터: videos.list 는 문서상 1 unit (할당량 모니터링용 로그)
    logger.info(
        "youtube_data_api_videos_list_ok",
        extra={
            "youtube_api": True,
            "method": "videos.list",
            "quota_units": 1,
            "video_id": video_id,
        },
    )
    return {
        "video_id": video_id,
        "title": (sn.get("title") or "").strip(),
        "description": (sn.get("description") or "").strip(),
        "thumbnail_url": thumb_url,
        "duration_seconds": duration_seconds,
    }


def fetch_metadata_ytdlp(url: str) -> dict[str, Any]:
    """yt-dlp 로 제목·설명·썸네일·길이(초) (API 키 불필요)."""
    import yt_dlp

    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "nocheckcertificate": False,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if not info:
        raise RuntimeError("yt-dlp로 영상 정보를 가져오지 못했습니다.")
    logger.info(
        "youtube_metadata_ytdlp_ok",
        extra={"youtube_api": False, "source": "yt_dlp", "video_id": info.get("id")},
    )
    vid = info.get("id") or ""
    title = (info.get("title") or "").strip()
    description = (info.get("description") or "").strip()
    thumb_url = info.get("thumbnail")
    if not thumb_url and info.get("thumbnails"):
        thumbs = info["thumbnails"]
        if isinstance(thumbs, list) and thumbs:
            thumb_url = thumbs[-1].get("url")
    return {
        "video_id": vid,
        "title": title,
        "description": description,
        "thumbnail_url": thumb_url,
        "duration_seconds": info.get("duration"),
    }


def fetch_transcript_text(video_id: str, max_chars: int = 24_000) -> str:
    """
    공개 자막이 있으면 텍스트로 이어붙인다. 없으면 빈 문자열.

    - 수동 한국어 → 자동 생성 한국어(요리 영상에 흔함) → 수동/자동 영어 → 그 외 첫 트랙.
    - ``get_transcript(..., languages=['ko'])`` 만으로는 **자동 생성 ko** 만 있는 영상에서 실패할 수 있어
      ``list_transcripts`` + ``find_generated_transcript`` 를 사용한다.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        logger.warning("youtube-transcript-api 미설치 — 자막 생략")
        return ""

    data = None
    try:
        tlist = YouTubeTranscriptApi.list_transcripts(video_id)
        tr = None
        for finder in (
            lambda: tlist.find_transcript(["ko"]),
            lambda: tlist.find_generated_transcript(["ko"]),
            lambda: tlist.find_transcript(["en"]),
            lambda: tlist.find_generated_transcript(["en"]),
        ):
            try:
                tr = finder()
                break
            except Exception:
                continue
        if tr is None:
            try:
                tr = next(iter(tlist))
            except (StopIteration, TypeError, Exception):
                tr = None
        if tr is None:
            return ""
        data = tr.fetch()
    except Exception as e:
        logger.info("자막 없음 video_id=%s: %s", video_id, e)
        return ""

    if not data:
        return ""
    text = " ".join(
        (d.get("text", "") if isinstance(d, dict) else "") for d in data
    )
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_chars:
        text = text[:max_chars] + "\n…(truncated)"
    return text


def fetch_youtube_bundle(url: str, youtube_api_key: Optional[str]) -> dict[str, Any]:
    """
    video_id, title, description, thumbnail_url, transcript 를 한 번에 수집.
    ``youtube_api_key`` 가 비어 있으면 yt-dlp 사용.
    """
    safe_url = normalize_and_validate_youtube_url(url)
    video_id = parse_youtube_video_id(safe_url)
    if not video_id:
        raise ValueError("지원하지 않는 YouTube URL 형식입니다.")

    if youtube_api_key:
        meta = fetch_metadata_google_api(video_id, youtube_api_key)
    else:
        meta = fetch_metadata_ytdlp(safe_url)
        if not meta.get("video_id"):
            meta["video_id"] = video_id

    transcript = fetch_transcript_text(video_id)
    meta["transcript"] = transcript
    meta["source_url"] = safe_url
    return meta
