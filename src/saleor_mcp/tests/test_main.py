import httpx
import pytest

from saleor_mcp.docs import generate_html
from saleor_mcp.main import app, mcp


def test_mcp_instance_creation():
    assert app is not None
    assert mcp is not None
    assert hasattr(mcp, "http_app")
    assert hasattr(mcp, "run")


@pytest.mark.asyncio
async def test_generate_html_includes_mounted_tools():
    html = await generate_html()

    assert '<span class="tool-name">Channels</span>' in html
    assert '<span class="tool-name">Orders</span>' in html
    assert '<span class="tool-name">Products</span>' in html


@pytest.mark.asyncio
async def test_index_route_generates_docs_html():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert '<span class="tool-name">Channels</span>' in response.text
