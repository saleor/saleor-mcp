import logging
import os
import re
from dataclasses import dataclass, field
from enum import StrEnum
from urllib.parse import urlparse

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)
logging.getLogger("mcp.server.streamable_http").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Whether we have already warned that no domain allowlist is configured. The warning
# is a once-per-process nudge, not a per-request log line.
_warned_no_domain_pattern = False


class Mode(StrEnum):
    """Safety mode controlling which operations the gateway will execute.

    - READ_ONLY: only queries are allowed; mutations are rejected.
    - READ_WRITE: queries and mutations are allowed, except blocked mutations.
    - UNRESTRICTED: queries and mutations are allowed with no denylist.
    """

    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    UNRESTRICTED = "unrestricted"


# Mutations blocked by default in READ_WRITE mode. These touch identity, access
# control, app installation and instance-wide settings - the operations most likely
# to cause irreversible damage or privilege escalation. Power users can opt out by
# switching to UNRESTRICTED mode or editing SALEOR_MCP_ALLOWED_MUTATIONS.
DEFAULT_BLOCKED_MUTATIONS: frozenset[str] = frozenset(
    {
        # Staff & user identity
        "staffCreate",
        "staffUpdate",
        "staffDelete",
        "staffBulkDelete",
        "customerDelete",
        "customerBulkDelete",
        "userAvatarDelete",
        "setPassword",
        "requestPasswordReset",
        # Access control / permission groups
        "permissionGroupCreate",
        "permissionGroupUpdate",
        "permissionGroupDelete",
        # Apps, tokens & authentication
        "appCreate",
        "appUpdate",
        "appDelete",
        "appDeleteFailedInstallation",
        "appInstall",
        "appRetryInstall",
        "appActivate",
        "appDeactivate",
        "appTokenCreate",
        "appTokenDelete",
        "appTokenVerify",
        "tokenCreate",
        "tokenRefresh",
        "tokensDeactivateAll",
        "externalLogout",
        # Plugins & instance settings
        "pluginUpdate",
        "shopSettingsUpdate",
        "shopDomainUpdate",
        "shopAddressUpdate",
        # Channel lifecycle
        "channelDelete",
        # Webhooks
        "webhookCreate",
        "webhookUpdate",
        "webhookDelete",
    }
)


def _parse_mutation_set(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


def validate_api_url(url: str, pattern: str | None) -> bool:
    r"""Validate the Saleor API URL.

    Always requires a well-formed ``http(s)`` URL with a host - this rejects
    ``file://``, host-less and otherwise malformed values regardless of ``pattern``.
    When ``pattern`` is set, the **full URL** must fully match it (via
    :func:`re.fullmatch`, so the pattern is implicitly anchored at both ends).

    The pattern must use a restrictive character class for the host, e.g.
    ``^https://([A-Za-z0-9._-]+)\.saleor\.cloud/graphql/$``. Never use ``.*`` for the
    host: because ``.*`` also matches ``/``, a pattern like
    ``^https://.*\.saleor\.cloud/`` is spoofable by an attacker-controlled path such as
    ``https://evil.example/.saleor.cloud/`` and would turn the server into an SSRF
    relay.
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False

    if not pattern:
        return True

    return bool(re.fullmatch(pattern, url))


def _warn_no_domain_restriction() -> None:
    """Warn once that the server will connect to any host the client supplies."""
    global _warned_no_domain_pattern
    if _warned_no_domain_pattern:
        return
    _warned_no_domain_pattern = True
    logger.warning(
        "ALLOWED_DOMAIN_PATTERN is not set: the server will connect to ANY api URL "
        "supplied by the client. This is fine for local stdio use, but it MUST be set "
        "in any hosted/public deployment to prevent the server being used as an SSRF "
        "relay."
    )


@dataclass
class PolicyConfig:
    """Safety policy resolved from environment variables."""

    mode: Mode = Mode.READ_ONLY
    blocked_mutations: set[str] = field(default_factory=set)
    allowed_mutations: set[str] = field(default_factory=set)

    @property
    def effective_blocklist(self) -> set[str]:
        """Mutations that are blocked given the current mode and overrides."""
        if self.mode in (Mode.READ_ONLY, Mode.UNRESTRICTED):
            # READ_ONLY blocks all mutations elsewhere; UNRESTRICTED blocks none.
            return set()
        return self.blocked_mutations - self.allowed_mutations


@dataclass
class SaleorConfig:
    api_url: str
    auth_token: str


def get_policy_config() -> PolicyConfig:
    """Resolve the safety policy from environment variables."""
    raw_mode = os.getenv("SALEOR_MCP_MODE", Mode.READ_ONLY.value).strip().lower()
    try:
        mode = Mode(raw_mode)
    except ValueError as exc:
        valid = ", ".join(m.value for m in Mode)
        raise ToolError(
            f"Invalid SALEOR_MCP_MODE '{raw_mode}'. Valid values: {valid}"
        ) from exc

    blocked_env = _parse_mutation_set(os.getenv("SALEOR_MCP_BLOCKED_MUTATIONS"))
    blocked = set(DEFAULT_BLOCKED_MUTATIONS) | blocked_env
    allowed = _parse_mutation_set(os.getenv("SALEOR_MCP_ALLOWED_MUTATIONS"))

    return PolicyConfig(
        mode=mode,
        blocked_mutations=blocked,
        allowed_mutations=allowed,
    )


def get_saleor_config() -> SaleorConfig:
    """Resolve Saleor connection config from HTTP headers or environment.

    HTTP headers (``X-Saleor-API-URL`` / ``X-Saleor-Auth-Token``) take precedence
    when present, which covers the hosted Streamable HTTP transport. When running
    over stdio there is no request context, so the values fall back to the
    ``SALEOR_API_URL`` / ``SALEOR_AUTH_TOKEN`` environment variables.
    """

    allowed_domain_pattern = os.getenv("ALLOWED_DOMAIN_PATTERN", "")
    headers = get_http_headers()

    api_url = headers.get("x-saleor-api-url") or os.getenv("SALEOR_API_URL")
    if not api_url:
        raise ToolError(
            "Missing Saleor API URL. Set the X-Saleor-API-URL header (HTTP) or the "
            "SALEOR_API_URL environment variable (stdio)."
        )

    if not validate_api_url(api_url, allowed_domain_pattern):
        raise ToolError(f"API URL '{api_url}' is not allowed")

    if not allowed_domain_pattern:
        _warn_no_domain_restriction()

    auth_token = headers.get("x-saleor-auth-token") or os.getenv("SALEOR_AUTH_TOKEN")
    if not auth_token:
        raise ToolError(
            "Missing Saleor auth token. Set the X-Saleor-Auth-Token header (HTTP) or "
            "the SALEOR_AUTH_TOKEN environment variable (stdio)."
        )

    return SaleorConfig(
        api_url=api_url,
        auth_token=auth_token,
    )


# Backwards-compatible alias retained during the v2 transition.
get_config_from_headers = get_saleor_config
