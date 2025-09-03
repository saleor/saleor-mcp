import pytest
from fastmcp.exceptions import ToolError

from saleor_mcp.config import get_config_from_headers, validate_api_url


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
