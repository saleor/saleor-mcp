import pytest
from fastmcp.exceptions import ToolError

from saleor_mcp.config import (
    DEFAULT_BLOCKED_MUTATIONS,
    Mode,
    get_config_from_headers,
    get_policy_config,
    get_saleor_config,
    validate_api_url,
)

# The pattern deployed in production. Restrictive host char class + full anchoring.
PROD_PATTERN = r"^https://([A-Za-z0-9-_\.]+)\.saleor\.cloud/graphql/$"


@pytest.mark.parametrize(
    ("url", "pattern", "expected"),
    [
        # The full URL must match the pattern.
        (
            "https://exactmatch.saleor.cloud/graphql/",
            r"https://exactmatch\.saleor\.cloud/graphql/",
            True,
        ),
        # Production pattern: legitimate Saleor Cloud URLs (incl. nested subdomains).
        ("https://demo.saleor.cloud/graphql/", PROD_PATTERN, True),
        ("https://a.b.demo.saleor.cloud/graphql/", PROD_PATTERN, True),
        ("https://other.saleor.cloud/graphql/", PROD_PATTERN, True),
        # Production pattern rejects non-Saleor hosts.
        ("https://other.example.com/graphql/", PROD_PATTERN, False),
        # An empty pattern allows any well-formed http(s) URL.
        ("https://anything.example.com/graphql/", "", True),
        ("https://anything.example.com/graphql/", None, True),
        # Non-http(s) schemes and host-less URLs are always rejected.
        ("file:///etc/passwd", "", False),
        ("file:///etc/passwd", PROD_PATTERN, False),
        ("ftp://example.com/", "", False),
        ("not-a-url", "", False),
        # SSRF spoofing attempts are all rejected by the production pattern: the
        # allowed domain must be the real host, not smuggled into the path, query
        # or userinfo, and must not be an attacker-controlled suffix.
        ("https://evil.example/.saleor.cloud/graphql/", PROD_PATTERN, False),
        ("https://evil.example/x.saleor.cloud/graphql/", PROD_PATTERN, False),
        ("https://demo.saleor.cloud@evil.example/graphql/", PROD_PATTERN, False),
        ("https://demo.saleor.cloud.evil.example/graphql/", PROD_PATTERN, False),
        ("https://evil.example/?u=https://a.saleor.cloud/graphql/", PROD_PATTERN, False),
        # fullmatch (unlike the previous re.match + "$") rejects a trailing newline.
        ("https://demo.saleor.cloud/graphql/\n", PROD_PATTERN, False),
    ],
)
def test_validate_api_url(url, pattern, expected):
    assert validate_api_url(url, pattern) == expected


def test_get_config_from_headers_no_allowed_domain_pattern(monkeypatch):
    monkeypatch.delenv("ALLOWED_DOMAIN_PATTERN", raising=False)
    headers = {
        "x-saleor-api-url": "https://my.saleor.cloud",
        "x-saleor-auth-token": "mytoken",
    }

    def mock_get_http_headers():
        return headers

    monkeypatch.setattr(
        "saleor_mcp.config.get_http_headers",
        mock_get_http_headers,
    )

    config = get_config_from_headers()
    assert config.api_url == "https://my.saleor.cloud"
    assert config.auth_token == "mytoken"


def test_get_config_from_headers_with_allowed_domain_pattern(monkeypatch):
    monkeypatch.setenv("ALLOWED_DOMAIN_PATTERN", r"https://[a-z]+\.saleor\.cloud")
    headers = {
        "x-saleor-api-url": "https://my.saleor.cloud",
        "x-saleor-auth-token": "mytoken",
    }

    def mock_get_http_headers():
        return headers

    monkeypatch.setattr(
        "saleor_mcp.config.get_http_headers",
        mock_get_http_headers,
    )

    config = get_config_from_headers()
    assert config.api_url == "https://my.saleor.cloud"
    assert config.auth_token == "mytoken"


def test_get_config_from_headers_invalid_domain_pattern(monkeypatch):
    monkeypatch.setenv("ALLOWED_DOMAIN_PATTERN", r"https://[a-z]+\.saleor\.cloud")

    from saleor_mcp.config import get_config_from_headers

    headers = {
        "x-saleor-api-url": "https://notallowed.com",
        "x-saleor-auth-token": "mytoken",
    }

    def mock_get_http_headers():
        return headers

    monkeypatch.setattr(
        "saleor_mcp.config.get_http_headers",
        mock_get_http_headers,
    )

    with pytest.raises(
        ToolError, match="API URL 'https://notallowed.com' is not allowed"
    ):
        get_config_from_headers()


def test_get_config_rejects_ssrf_spoofed_host(monkeypatch):
    # The production pattern: a path-smuggled domain must not be accepted.
    monkeypatch.setenv("ALLOWED_DOMAIN_PATTERN", PROD_PATTERN)
    monkeypatch.setattr(
        "saleor_mcp.config.get_http_headers",
        lambda: {
            "x-saleor-api-url": "https://evil.example/.saleor.cloud/graphql/",
            "x-saleor-auth-token": "mytoken",
        },
    )

    with pytest.raises(ToolError, match="is not allowed"):
        get_saleor_config()


def _no_headers(monkeypatch):
    monkeypatch.setattr("saleor_mcp.config.get_http_headers", dict)


def test_get_saleor_config_from_env(monkeypatch):
    _no_headers(monkeypatch)
    monkeypatch.delenv("ALLOWED_DOMAIN_PATTERN", raising=False)
    monkeypatch.setenv("SALEOR_API_URL", "https://env.saleor.cloud/graphql/")
    monkeypatch.setenv("SALEOR_AUTH_TOKEN", "env-token")

    config = get_saleor_config()
    assert config.api_url == "https://env.saleor.cloud/graphql/"
    assert config.auth_token == "env-token"


def test_headers_take_precedence_over_env(monkeypatch):
    monkeypatch.setattr(
        "saleor_mcp.config.get_http_headers",
        lambda: {
            "x-saleor-api-url": "https://header.saleor.cloud/graphql/",
            "x-saleor-auth-token": "header-token",
        },
    )
    monkeypatch.delenv("ALLOWED_DOMAIN_PATTERN", raising=False)
    monkeypatch.setenv("SALEOR_API_URL", "https://env.saleor.cloud/graphql/")
    monkeypatch.setenv("SALEOR_AUTH_TOKEN", "env-token")

    config = get_saleor_config()
    assert config.api_url == "https://header.saleor.cloud/graphql/"
    assert config.auth_token == "header-token"


def test_get_saleor_config_missing_url(monkeypatch):
    _no_headers(monkeypatch)
    monkeypatch.delenv("SALEOR_API_URL", raising=False)
    monkeypatch.delenv("SALEOR_AUTH_TOKEN", raising=False)
    with pytest.raises(ToolError, match="Missing Saleor API URL"):
        get_saleor_config()


def test_get_saleor_config_missing_token(monkeypatch):
    _no_headers(monkeypatch)
    monkeypatch.delenv("ALLOWED_DOMAIN_PATTERN", raising=False)
    monkeypatch.setenv("SALEOR_API_URL", "https://env.saleor.cloud/graphql/")
    monkeypatch.delenv("SALEOR_AUTH_TOKEN", raising=False)
    with pytest.raises(ToolError, match="Missing Saleor auth token"):
        get_saleor_config()


def test_get_policy_config_defaults_to_read_only(monkeypatch):
    monkeypatch.delenv("SALEOR_MCP_MODE", raising=False)
    monkeypatch.delenv("SALEOR_MCP_BLOCKED_MUTATIONS", raising=False)
    monkeypatch.delenv("SALEOR_MCP_ALLOWED_MUTATIONS", raising=False)

    policy = get_policy_config()
    assert policy.mode is Mode.READ_ONLY
    # READ_ONLY blocks all mutations elsewhere, so effective blocklist is empty.
    assert policy.effective_blocklist == set()
    assert "staffDelete" in policy.blocked_mutations


def test_get_policy_config_read_write_uses_default_blocklist(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "read_write")
    monkeypatch.delenv("SALEOR_MCP_BLOCKED_MUTATIONS", raising=False)
    monkeypatch.delenv("SALEOR_MCP_ALLOWED_MUTATIONS", raising=False)

    policy = get_policy_config()
    assert policy.mode is Mode.READ_WRITE
    assert DEFAULT_BLOCKED_MUTATIONS <= policy.effective_blocklist
    assert "staffDelete" in policy.effective_blocklist


def test_get_policy_config_allow_override(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "read_write")
    monkeypatch.delenv("SALEOR_MCP_BLOCKED_MUTATIONS", raising=False)
    monkeypatch.setenv("SALEOR_MCP_ALLOWED_MUTATIONS", "staffDelete, appDelete")

    policy = get_policy_config()
    assert "staffDelete" not in policy.effective_blocklist
    assert "appDelete" not in policy.effective_blocklist


def test_get_policy_config_extra_blocked(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "read_write")
    monkeypatch.setenv("SALEOR_MCP_BLOCKED_MUTATIONS", "productDelete")
    monkeypatch.delenv("SALEOR_MCP_ALLOWED_MUTATIONS", raising=False)

    policy = get_policy_config()
    assert "productDelete" in policy.effective_blocklist


def test_unrestricted_blocklist_is_empty(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "unrestricted")
    monkeypatch.delenv("SALEOR_MCP_BLOCKED_MUTATIONS", raising=False)
    monkeypatch.delenv("SALEOR_MCP_ALLOWED_MUTATIONS", raising=False)

    policy = get_policy_config()
    assert policy.mode is Mode.UNRESTRICTED
    assert policy.effective_blocklist == set()


def test_get_policy_config_invalid_mode(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "bogus")
    with pytest.raises(ToolError, match="Invalid SALEOR_MCP_MODE"):
        get_policy_config()
