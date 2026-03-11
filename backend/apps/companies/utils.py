from apps.companies.models import Company


def get_administered_companies(user):
    if not getattr(user, "is_authenticated", False) or getattr(user, "role", None) != "company":
        return Company.objects.none()
    return Company.objects.filter(admin=user)


def get_employee_profile(user):
    if not getattr(user, "is_authenticated", False) or getattr(user, "role", None) != "employee":
        return None
    return getattr(user, "employee_profile", None)
