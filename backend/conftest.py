import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="testadmin",
        email="admin@test.com",
        password="testpass123",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def company_admin_user(db):
    return User.objects.create_user(
        username="testcompanyadmin",
        email="companyadmin@test.com",
        password="testpass123",
        role="company",
    )


@pytest.fixture
def employee_user(db):
    return User.objects.create_user(
        username="testemployee",
        email="employee@test.com",
        password="testpass123",
        role="employee",
    )


@pytest.fixture
def guard_user(db):
    return User.objects.create_user(
        username="testguard",
        email="guard@test.com",
        password="testpass123",
        role="guard",
    )


@pytest.fixture
def authenticated_admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def authenticated_company_client(api_client, company_admin_user):
    api_client.force_authenticate(user=company_admin_user)
    return api_client
