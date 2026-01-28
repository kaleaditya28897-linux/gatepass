from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("gates", views.GateViewSet, basename="gate")
router.register("guards", views.GuardViewSet, basename="guard")
router.register("shifts", views.GuardShiftViewSet, basename="shift")

urlpatterns = [
    path("", include(router.urls)),
]
