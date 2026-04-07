from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import FridgeItemViewSet, FridgeViewSet, StandardIngredientViewSet

app_name = "fridges"

router = DefaultRouter()
# standard-ingredients, items를 먼저 등록해 fridge pk로 매칭되지 않도록 함
router.register(r"standard-ingredients", StandardIngredientViewSet, basename="standard-ingredient")
router.register(r"items", FridgeItemViewSet, basename="fridge-item")
router.register(r"", FridgeViewSet, basename="fridge")

urlpatterns = [
    path("", include(router.urls)),
]
