from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("", views.CompanyViewSet, basename="company")

employee_router = DefaultRouter()
employee_router.register("", views.EmployeeViewSet, basename="employee")

urlpatterns = [
    path("", include(router.urls)),
    path("employees/", include(employee_router.urls)),
]
