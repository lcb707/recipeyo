from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class ChatSession(TimeStampedModel):
    """AI 챗봇 대화 세션."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_sessions',
    )
    title = models.CharField(max_length=200, blank=True, null=True)


class ChatMessage(models.Model):
    """챗봇 메시지 (user / assistant)."""

    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='chat_messages',
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
