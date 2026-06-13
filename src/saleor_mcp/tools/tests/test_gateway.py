from unittest.mock import AsyncMock, patch

import pytest
from fastmcp import Client as MCPClient
from fastmcp.exceptions import ToolError

from saleor_mcp.introspection import _load_bundled_schema
from saleor_mcp.main import mcp

QUERY = "query { products(first: 1) { edges { node { id } } } }"
MUTATION = (
    'mutation { productCreate(input: {name: "x"}) { product { id } errors { field } } }'
)
DANGEROUS = 'mutation { staffDelete(id: "1") { errors { field } } }'


@pytest.mark.asyncio
async def test_run_query_success():
    body = {"data": {"products": {"edges": []}}}
    with patch(
        "saleor_mcp.tools.gateway.execute_graphql",
        new=AsyncMock(return_value=body),
    ) as mock_exec:
        async with MCPClient(mcp) as client:
            result = await client.call_tool("run_query", {"query": QUERY})

    assert result.data == body
    mock_exec.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_query_rejects_mutation():
    async with MCPClient(mcp) as client:
        with pytest.raises(ToolError, match="run_mutation"):
            await client.call_tool("run_query", {"query": MUTATION})


@pytest.mark.asyncio
async def test_run_mutation_blocked_in_read_only(monkeypatch):
    monkeypatch.delenv("SALEOR_MCP_MODE", raising=False)
    async with MCPClient(mcp) as client:
        with pytest.raises(ToolError, match="read_only mode"):
            await client.call_tool("run_mutation", {"query": MUTATION})


@pytest.mark.asyncio
async def test_run_mutation_success_in_read_write(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "read_write")
    body = {"data": {"productCreate": {"product": {"id": "1"}, "errors": []}}}
    with patch(
        "saleor_mcp.tools.gateway.execute_graphql",
        new=AsyncMock(return_value=body),
    ) as mock_exec:
        async with MCPClient(mcp) as client:
            result = await client.call_tool("run_mutation", {"query": MUTATION})

    assert result.data == body
    mock_exec.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_mutation_dangerous_blocked_in_read_write(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "read_write")
    monkeypatch.delenv("SALEOR_MCP_ALLOWED_MUTATIONS", raising=False)
    async with MCPClient(mcp) as client:
        with pytest.raises(ToolError, match="blocked by the current safety policy"):
            await client.call_tool("run_mutation", {"query": DANGEROUS})


@pytest.mark.asyncio
async def test_run_mutation_dangerous_allowed_when_unrestricted(monkeypatch):
    monkeypatch.setenv("SALEOR_MCP_MODE", "unrestricted")
    body = {"data": {"staffDelete": {"errors": []}}}
    with patch(
        "saleor_mcp.tools.gateway.execute_graphql",
        new=AsyncMock(return_value=body),
    ):
        async with MCPClient(mcp) as client:
            result = await client.call_tool("run_mutation", {"query": DANGEROUS})

    assert result.data == body


@pytest.mark.asyncio
async def test_introspect_schema_search():
    schema = _load_bundled_schema()
    with patch(
        "saleor_mcp.tools.gateway.get_schema",
        new=AsyncMock(return_value=schema),
    ):
        async with MCPClient(mcp) as client:
            result = await client.call_tool(
                "introspect_schema", {"action": "search", "search": "warehouse"}
            )

    assert result.data["keyword"] == "warehouse"
    assert any(t["name"] == "Warehouse" for t in result.data["types"])


@pytest.mark.asyncio
async def test_introspect_schema_describe_operation():
    schema = _load_bundled_schema()
    with patch(
        "saleor_mcp.tools.gateway.get_schema",
        new=AsyncMock(return_value=schema),
    ):
        async with MCPClient(mcp) as client:
            result = await client.call_tool(
                "introspect_schema",
                {"action": "describe_operation", "name": "productCreate"},
            )

    assert result.data["kind"] == "mutation"
    assert any(arg["name"] == "input" for arg in result.data["args"])


@pytest.mark.asyncio
async def test_introspect_schema_missing_argument():
    schema = _load_bundled_schema()
    with patch(
        "saleor_mcp.tools.gateway.get_schema",
        new=AsyncMock(return_value=schema),
    ):
        async with MCPClient(mcp) as client:
            result = await client.call_tool(
                "introspect_schema", {"action": "search"}
            )

    assert "error" in result.data


@pytest.mark.asyncio
async def test_connection_info(monkeypatch):
    monkeypatch.setattr("saleor_mcp.config.get_http_headers", dict)
    monkeypatch.delenv("ALLOWED_DOMAIN_PATTERN", raising=False)
    monkeypatch.setenv("SALEOR_API_URL", "https://shop.saleor.cloud/graphql/")
    monkeypatch.setenv("SALEOR_AUTH_TOKEN", "tok")
    monkeypatch.setenv("SALEOR_MCP_MODE", "read_write")

    body = {
        "data": {
            "me": {
                "email": "admin@example.com",
                "isStaff": True,
                "userPermissions": [{"code": "MANAGE_PRODUCTS"}],
            },
            "app": None,
            "shop": {"name": "Demo", "version": "3.21.0"},
        }
    }
    with patch(
        "saleor_mcp.tools.gateway.execute_graphql",
        new=AsyncMock(return_value=body),
    ):
        async with MCPClient(mcp) as client:
            result = await client.call_tool("connection_info", {})

    data = result.data
    assert data["apiUrl"] == "https://shop.saleor.cloud/graphql/"
    assert data["mode"] == "read_write"
    assert data["writesEnabled"] is True
    assert data["user"]["permissions"] == ["MANAGE_PRODUCTS"]
    assert "staffDelete" in data["blockedMutations"]
