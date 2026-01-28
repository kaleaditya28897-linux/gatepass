from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "recipient", "recipient_phone", "recipient_email",
            "channel", "subject", "message", "status",
            "error_message", "sent_at", "created_at",
        ]
