from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ConnectGroupViewSet,
    CookingJournalCommentViewSet,
    CookingJournalViewSet,
    NotificationsViewSet,
    RecipeScrapViewSet,
    ScrapFolderViewSet,
)

app_name = "community"

router = DefaultRouter()
router.register(r"groups", ConnectGroupViewSet, basename="connect-group")
router.register(r"scrap-folders", ScrapFolderViewSet, basename="scrap-folder")
router.register(r"recipe-scraps", RecipeScrapViewSet, basename="recipe-scrap")
router.register(r"notifications", NotificationsViewSet, basename="notification")
router.register(r"cooking-journals", CookingJournalViewSet, basename="cooking-journal")
router.register(r"comments", CookingJournalCommentViewSet, basename="cooking-journal-comment")

urlpatterns = [
    path("", include(router.urls)),
]
