from rest_framework import viewsets
from apps.accounts.permissions import IsAdmin
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["channel", "status"]
    search_fields = ["recipient_phone", "recipient_email", "message"]
    ordering_fields = ["created_at", "sent_at"]

    def get_queryset(self):
        return Notification.objects.all()
