from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from saleor_mcp.old_saleor_client import SaleorRequestError, make_saleor_request


def create_mock_http_client(response_data=None, side_effect=None, status_error=None):
    mock_client = MagicMock()
    if side_effect:
        mock_post = AsyncMock(side_effect=side_effect)
    else:
        mock_response_obj = MagicMock()
        if response_data is not None:
            mock_response_obj.json.return_value = response_data
        if status_error:
            mock_response_obj.raise_for_status.side_effect = status_error
        else:
            mock_response_obj.raise_for_status.return_value = None
        mock_post = AsyncMock(return_value=mock_response_obj)

    mock_client.return_value.__aenter__.return_value.post = mock_post
    return mock_client


def test_error_with_message_only():
    error = SaleorRequestError("Test error message")
    assert str(error) == "Test error message"
    assert error.message == "Test error message"
    assert error.code is None


def test_error_with_message_and_code():
    error = SaleorRequestError("Test error message", "ERROR_CODE")
    assert str(error) == "Test error message"
    assert error.message == "Test error message"
    assert error.code == "ERROR_CODE"


@pytest.mark.asyncio
async def test_successful_request(mock_http_headers):
    response_data = {
        "data": {
            "orders": {
                "edges": [{"node": {"id": "1", "number": "001"}}],
                "pageInfo": {"hasNextPage": False},
            }
        }
    }
    mock_client = create_mock_http_client(response_data)

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        result = await make_saleor_request(
            query="query { orders { edges { node { id } } } }",
            variables={"first": 10},
        )

        expected_data = response_data["data"]
        assert result == expected_data

        mock_post = mock_client.return_value.__aenter__.return_value.post
        mock_post.assert_called_once_with(
            "https://example.saleor.cloud/graphql/",
            json={
                "query": "query { orders { edges { node { id } } } }",
                "variables": {"first": 10},
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer test-token",
            },
            timeout=30.0,
        )


@pytest.mark.asyncio
async def test_graphql_errors_in_response(mock_http_headers):
    response_data = {
        "errors": [
            {
                "message": "Invalid token",
                "extensions": {"exception": {"code": "INVALID_TOKEN"}},
            }
        ]
    }
    mock_client = create_mock_http_client(response_data)

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        with pytest.raises(SaleorRequestError) as exc_info:
            await make_saleor_request(
                query="query { orders { edges { node { id } } } }",
                variables={},
            )

        assert exc_info.value.message == "Invalid token"
        assert exc_info.value.code == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_graphql_error_without_code(mock_http_headers):
    response_data = {"errors": [{"message": "Some error without code"}]}
    mock_client = create_mock_http_client(response_data=response_data)

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        with pytest.raises(SaleorRequestError) as exc_info:
            await make_saleor_request(
                query="query { orders { edges { node { id } } } }",
                variables={},
            )

        assert exc_info.value.message == "Some error without code"
        assert exc_info.value.code is None


@pytest.mark.asyncio
async def test_http_status_error(mock_http_headers):
    mock_response_obj = MagicMock()
    mock_response_obj.status_code = 404
    mock_response_obj.text = "Not Found"
    status_error = httpx.HTTPStatusError(
        "404 Not Found", request=MagicMock(), response=mock_response_obj
    )
    mock_client = create_mock_http_client(status_error=status_error)

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        with pytest.raises(SaleorRequestError) as exc_info:
            await make_saleor_request(
                query="query { orders { edges { node { id } } } }",
                variables={},
            )

        assert "HTTP error 404: Not Found" in exc_info.value.message
        assert exc_info.value.code == "404"


@pytest.mark.asyncio
async def test_request_error(mock_http_headers):
    mock_client = create_mock_http_client(
        side_effect=httpx.RequestError("Connection failed")
    )

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        with pytest.raises(SaleorRequestError) as exc_info:
            await make_saleor_request(
                query="query { orders { edges { node { id } } } }",
                variables={},
            )

        assert exc_info.value.message == "Network error while connecting to Saleor"
        assert exc_info.value.code is None


@pytest.mark.asyncio
async def test_unexpected_error(mock_http_headers):
    mock_client = create_mock_http_client(side_effect=Exception("Unexpected error"))

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        with pytest.raises(SaleorRequestError) as exc_info:
            await make_saleor_request(
                query="query { orders { edges { node { id } } } }",
                variables={},
            )

        expected_message = "An unexpected error occurred while making request to Saleor: Unexpected error"
        assert exc_info.value.message == expected_message
        assert exc_info.value.code is None


@pytest.mark.asyncio
async def test_successful_request_with_empty_data(mock_http_headers):
    response_data = {"data": {}}
    mock_client = create_mock_http_client(response_data)

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        result = await make_saleor_request(
            query="query { orders { edges { node { id } } } }",
            variables={},
        )

        assert result == {}


@pytest.mark.asyncio
async def test_successful_request_without_data_field(mock_http_headers):
    response_data = {"some_other_field": "value"}
    mock_client = create_mock_http_client(response_data)

    with (
        patch("httpx.AsyncClient", return_value=mock_client.return_value),
        patch("saleor_mcp.config.get_http_headers", return_value=mock_http_headers),
    ):
        result = await make_saleor_request(
            query="query { orders { edges { node { id } } } }",
            variables={},
        )

        assert result == {}
