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


@pytest.mark.parametrize(
    ("url", "pattern", "expected"),
    [
        (
            "https://exactmatch.saleor.cloud",
            r"https:\/\/exactmatch\.saleor\.cloud",
            True,
        ),
        ("https://exactmatch.example.com", r"https:\/\/exactmatch\.example\.com", True),
        ("https://example-domain.saleor.cloud", r"https:\/\/.*\.saleor\.cloud", True),
        ("https://example.saleor.cloud", r"https:\/\/.*\.saleor\.cloud", True),
        (
            "https://example.saleor.cloud/graphql/",
            r"https:\/\/.*\.saleor\.cloud\/graphql\/",
            True,
        ),
        ("https://sub.domain.saleor.cloud", r"https:\/\/.*\.saleor\.cloud", True),
        ("https://other.saleor.cloud", r"https:\/\/exact\.saleor\.cloud", False),
        ("https://malicious-saleor.cloud", r"https:\/\/.*\.saleor\.cloud", False),
        (
            "https://example.com?url=https://a.saleor.cloud/",
            r"https:\/\/.*\.saleor\.cloud",
            False,
        ),
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
    monkeypatch.setenv("ALLOWED_DOMAIN_PATTERN", r"https://.*\.saleor\.cloud")
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
    monkeypatch.setenv("ALLOWED_DOMAIN_PATTERN", r"https://.*\.saleor\.cloud")

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
