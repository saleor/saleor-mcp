"""Generate static HTML documentation from Jinja2 template."""

import inspect
import logging
import tomllib
from pathlib import Path
from typing import Annotated, Any, get_args, get_origin, get_type_hints

from fastmcp import FastMCP
from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)


def get_version_from_pyproject() -> str:
    """Read version from pyproject.toml.

    Returns:
        Version string from pyproject.toml, or "unknown" if not found.

    """
    try:
        # Find pyproject.toml - go up from this file to project root
        project_root = Path(__file__).parent.parent.parent
        pyproject_path = project_root / "pyproject.toml"

        if pyproject_path.exists():
            with open(pyproject_path, "rb") as f:
                data = tomllib.load(f)
                return data.get("project", {}).get("version", "unknown")
    except Exception:
        logger.warning("Failed to read version from pyproject.toml")

    return "unknown"


def generate_html(output_path: str | None = None) -> str:
    """Generate HTML documentation from tools.

    Automatically discovers all tools from the main MCP server and its mounted
    routers, eliminating the need to manually maintain a list of routers.

    Args:
        output_path: Optional path to write the HTML file to.
                    If None, returns the HTML string without writing.

    Returns:
        Generated HTML content as string.

    """
    # Import here to avoid circular dependency
    from saleor_mcp.main import mcp

    # Introspect tools from the MCP server and all mounted routers
    tools = introspect_from_mcp_server(mcp)

    # Get version from pyproject.toml
    version = get_version_from_pyproject()

    # Setup Jinja2 environment
    template_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template("index.html.jinja")

    # Render template
    html_content = template.render(
        tools=tools,
        version=version,
    )

    # Write to file if path provided
    if output_path:
        output_file = Path(output_path)
        output_file.write_text(html_content, encoding="utf-8")
        print(f"Generated HTML documentation at: {output_file}")

    return html_content


def get_type_name(type_hint: Any) -> str:
    """Convert a type hint to a readable string."""
    origin = get_origin(type_hint)

    if origin is None:
        # Simple type like int, str, etc.
        if hasattr(type_hint, "__name__"):
            return type_hint.__name__
        return str(type_hint)

    # Handle Union types (including Optional)
    if origin is type(None) or str(origin) == "typing.Union":
        args = get_args(type_hint)
        # Filter out NoneType for Optional
        non_none_args = [arg for arg in args if arg is not type(None)]
        if len(non_none_args) == 1:
            return f"{get_type_name(non_none_args[0])} | None"
        return " | ".join(get_type_name(arg) for arg in args)

    # Handle generic types like list, dict
    if origin in (list, dict, tuple):
        args = get_args(type_hint)
        if args:
            arg_names = ", ".join(get_type_name(arg) for arg in args)
            return f"{origin.__name__}[{arg_names}]"
        return origin.__name__

    return str(type_hint)


def extract_param_info(func: Any) -> list[dict[str, Any]]:
    """Extract parameter information from a function.

    Returns a list of dicts with keys: name, type, description, required, default.

    """
    params = []
    sig = inspect.signature(func)
    type_hints = get_type_hints(func, include_extras=True)

    for param_name, param in sig.parameters.items():
        # Skip 'ctx' parameter as it's internal
        if param_name == "ctx":
            continue

        param_info = {
            "name": param_name,
            "description": "",
            "required": param.default is inspect.Parameter.empty,
            "default": (
                None if param.default is inspect.Parameter.empty else param.default
            ),
        }

        # Get type information
        if param_name in type_hints:
            type_hint = type_hints[param_name]

            # Check if it's Annotated type
            if get_origin(type_hint) is Annotated:
                args = get_args(type_hint)
                if len(args) >= 2:
                    # First arg is the actual type, second is the description
                    actual_type = args[0]
                    param_info["type"] = get_type_name(actual_type)
                    param_info["description"] = (
                        args[1] if isinstance(args[1], str) else ""
                    )
            else:
                param_info["type"] = get_type_name(type_hint)
        else:
            param_info["type"] = "Any"

        params.append(param_info)

    return params


def extract_tool_info(router: FastMCP) -> list[dict[str, Any]]:
    """Extract tool information from a FastMCP router.

    Returns a list of tool dictionaries with:
    - id: tool identifier (function name)
    - name: human-readable name (title case of function name)
    - description: from docstring
    - arguments: list of parameter info
    """
    tools = []

    # Access the tool manager's internal tools dictionary
    if hasattr(router, "_tool_manager") and hasattr(router._tool_manager, "_tools"):
        router_tools = router._tool_manager._tools

        for tool_name, tool in router_tools.items():
            func = tool.fn

            # Get the actual function (unwrap if needed)
            if hasattr(func, "__wrapped__"):
                func = func.__wrapped__

            # Extract docstring
            docstring = inspect.getdoc(func) or ""
            # Take first two paragraphs as description
            description = (
                "".join(docstring.split("\n\n")[:2]).replace("\n", " ").strip()
            )

            # Extract parameters
            arguments = extract_param_info(func)

            # Create human-readable name from function name
            # e.g., "list_orders" -> "List Orders"
            name = tool_name.replace("_", " ").title()

            tool_info = {
                "id": tool_name,
                "name": name,
                "description": description,
                "arguments": arguments,
            }

            tools.append(tool_info)

    return tools


def introspect_from_mcp_server(mcp_server: FastMCP) -> list[dict[str, Any]]:
    """Introspect all tools from a FastMCP server and its mounted routers.

    This function automatically discovers all mounted routers in the MCP server
    and extracts tool information from them, eliminating the need to manually
    maintain a list of routers.

    Args:
        mcp_server: The main FastMCP server instance

    Returns:
        Combined list of all tool information from all mounted routers.

    """
    all_tools = []

    # Get tools from the main server itself
    main_tools = extract_tool_info(mcp_server)
    all_tools.extend(main_tools)

    # Get tools from all mounted routers
    if hasattr(mcp_server, "_tool_manager") and hasattr(
        mcp_server._tool_manager, "_mounted_servers"
    ):
        mounted_servers = mcp_server._tool_manager._mounted_servers
        for mounted_server in mounted_servers:
            if hasattr(mounted_server, "server"):
                router = mounted_server.server
                router_tools = extract_tool_info(router)
                all_tools.extend(router_tools)

    # Sort tools by name for consistent ordering
    all_tools.sort(key=lambda x: x["name"])

    return all_tools
