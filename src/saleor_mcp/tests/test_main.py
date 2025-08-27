from saleor_mcp.main import app, mcp


def test_mcp_instance_creation():
    assert app is not None
    assert mcp is not None
    assert hasattr(mcp, "http_app")
    assert hasattr(mcp, "run")
