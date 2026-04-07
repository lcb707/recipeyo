"""
냉장고·냉장고 식재료 비즈니스 로직.
권한 검사, 유통기한 자동 설정, 만료 일괄 갱신 등.
"""
from datetime import timedelta
from datetime import date as date_type

from django.db import transaction
from django.utils import timezone

from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode

from .models import Fridge, FridgeItem, StandardIngredient
from community.models import ConnectGroupMember


def _parse_expiry_date(value):
    """item_data.expiry_date가 date면 그대로, 문자열이면 파싱 후 반환. 실패 시 None."""
    if value is None:
        return None
    if isinstance(value, date_type):
        return value
    if isinstance(value, str):
        try:
            return timezone.datetime.strptime(value[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None
    return None


def _user_has_fridge_access(user, fridge: Fridge) -> bool:
    """해당 유저가 냉장고에 접근 권한이 있는지 (소유자 또는 공유 그룹 멤버)."""
    if fridge.owner_id == user.id:
        return True
    if fridge.group_id:
        group = getattr(fridge, "group", None)
        if group is None:
            return False
        if getattr(group, "is_active", True) is False:
            return False
        if group.connect_group_members.filter(
            user=user,
            status=ConnectGroupMember.Status.ACCEPTED,
        ).exists():
            return True
    return False


def get_or_create_my_fridge(user) -> Fridge:
    """
    해당 유저의 개인 냉장고(owner=user, fridge_type=personal)를 반환.
    없으면 이름 '나의 냉장고'로 생성 후 반환.
    """
    fridge = Fridge.objects.filter(
        owner=user,
        fridge_type=Fridge.FridgeType.PERSONAL,
    ).first()
    if fridge is None:
        fridge = Fridge.objects.create(
            owner=user,
            name="나의 냉장고",
            fridge_type=Fridge.FridgeType.PERSONAL,
        )
    return fridge


class FridgeService:
    @staticmethod
    @transaction.atomic
    def add_fridge_item(user, fridge_id, item_data: dict) -> FridgeItem:
        """
        냉장고에 식재료 추가. 권한 없으면 BusinessLogicException.
        expiry_date가 item_data에 있으면 사용, 없으면 StandardIngredient 기준 또는 7일 기본.
        """
        fridge = Fridge.objects.filter(pk=fridge_id).first()
        if not fridge:
            raise BusinessLogicException(
                message="해당 냉장고를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        if not _user_has_fridge_access(user, fridge):
            raise BusinessLogicException(
                message="해당 냉장고에 대한 접근 권한이 없습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )

        name = (item_data.get("name") or "").strip()
        if not name:
            raise BusinessLogicException(
                message="식자재명은 필수입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        if not StandardIngredient.objects.filter(name__iexact=name).exists():
            raise BusinessLogicException(
                message="사전에 등록되지 않은 식재료는 추가할 수 없습니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

        expiry_date = _parse_expiry_date(item_data.get("expiry_date"))
        standard = StandardIngredient.objects.filter(name__iexact=name).first()

        if expiry_date is None:
            default_days = standard.default_expiry_days if standard else 7
            expiry_date = timezone.localdate() + timedelta(days=default_days)

        unit = item_data.get("unit")
        if (unit is None or (isinstance(unit, str) and not unit.strip())) and standard:
            unit = standard.default_unit

        item = FridgeItem.objects.create(
            fridge=fridge,
            name=name,
            quantity=item_data.get("quantity", "1"),
            unit=unit,
            expiry_date=expiry_date,
            status=FridgeItem.Status.ACTIVE,
            memo=item_data.get("memo"),
        )
        return item

    @staticmethod
    @transaction.atomic
    def update_fridge_item(user, item_id: int, partial_data: dict) -> FridgeItem:
        """
        냉장고 식자재 부분 수정. 권한 없으면 BusinessLogicException.
        허용 필드: quantity, expiry_date, status, memo.
        """
        from .selectors import get_fridge_item_for_user

        item = get_fridge_item_for_user(user, item_id)
        if "quantity" in partial_data:
            item.quantity = str(partial_data["quantity"]).strip() or "1"
        if "expiry_date" in partial_data:
            item.expiry_date = _parse_expiry_date(partial_data["expiry_date"])
        if "status" in partial_data:
            raw = partial_data["status"]
            if raw in (FridgeItem.Status.ACTIVE, FridgeItem.Status.CONSUMED,
                       FridgeItem.Status.EXPIRED, FridgeItem.Status.DISCARDED):
                item.status = raw
        if "memo" in partial_data:
            item.memo = partial_data["memo"] if partial_data["memo"] is not None else None
        item.save(update_fields=["quantity", "expiry_date", "status", "memo", "updated_at"])
        return item

    @staticmethod
    @transaction.atomic
    def delete_fridge_item(user, item_id: int) -> None:
        """
        냉장고 식자재 삭제. 소유자/그룹 멤버만 가능.
        실제 삭제 대신 상태를 DISCARDED로 변경(소프트 삭제).
        """
        from .selectors import get_fridge_item_for_user

        item = get_fridge_item_for_user(user, item_id)
        item.status = FridgeItem.Status.DISCARDED
        item.save(update_fields=["status", "updated_at"])

    @staticmethod
    def update_expired_items() -> int:
        """
        오늘 날짜 기준으로 expiry_date가 지난 ACTIVE 상태 FridgeItem을 EXPIRED로 일괄 변경.
        Celery Task 또는 주기적 호출용.
        """
        today = timezone.localdate()
        updated = FridgeItem.objects.filter(
            status=FridgeItem.Status.ACTIVE,
            expiry_date__lt=today,
        ).update(status=FridgeItem.Status.EXPIRED)
        return updated
