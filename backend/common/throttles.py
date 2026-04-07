from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AnonBurstRateThrottle(AnonRateThrottle):
    scope = "anon_burst"


class AnonDayRateThrottle(AnonRateThrottle):
    scope = "anon_day"


class UserBurstRateThrottle(UserRateThrottle):
    scope = "user_burst"


class UserDayRateThrottle(UserRateThrottle):
    scope = "user_day"


class YouTubeImportDayThrottle(UserRateThrottle):
    """유튜브 레시피 임포트: 사용자당 일일 횟수 제한."""

    scope = "youtube_import_day"


class YouTubeImportBurstThrottle(UserRateThrottle):
    """유튜브 레시피 임포트: 짧은 시간 연속 호출 방지."""

    scope = "youtube_import_burst"


class YouTubeImportPollThrottle(UserRateThrottle):
    """job_id 상태 폴링 전용 (일일 한도 소모 없이 burst 만)."""

    scope = "youtube_import_poll"
