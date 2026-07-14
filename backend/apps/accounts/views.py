from dj_rest_auth.views import LoginView
from dj_rest_auth.registration.views import RegisterView
from rest_framework.throttling import ScopedRateThrottle


class ThrottledLoginView(LoginView):
    """Login com rate limit por IP — mitiga brute force de credenciais."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class ThrottledRegisterView(RegisterView):
    """Registro com rate limit por IP — mitiga criação em massa/enumeração."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"
