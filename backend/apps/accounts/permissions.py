from rest_framework.permissions import SAFE_METHODS, BasePermission


class RolePermission(BasePermission):
    roles = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.roles)


class IsAdmin(RolePermission):
    roles = ("admin",)


class IsCompanyAdmin(RolePermission):
    roles = ("company",)


class IsEmployee(RolePermission):
    roles = ("employee",)


class IsGuard(RolePermission):
    roles = ("guard",)


class IsAdminOrCompanyAdmin(RolePermission):
    roles = ("admin", "company")


class IsAdminOrCompanyAdminOrEmployee(RolePermission):
    roles = ("admin", "company", "employee")


class IsAdminOrGuard(RolePermission):
    roles = ("admin", "guard")


class IsAdminOrCompanyAdminOrGuard(RolePermission):
    roles = ("admin", "company", "guard")


class IsAdminOrGuardReadOnly(BasePermission):
    """Admins have full access; guards may only read."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == "admin":
            return True
        return user.role == "guard" and request.method in SAFE_METHODS
