import tomllib
from pathlib import Path
from typing import Any


def get_pyproject_value(*keys: str, default: Any = None) -> str:
    """Retrieve a deeply nested value from pyproject.toml.

    Returns default if not found or error occurs.
    """
    try:
        root = Path(__file__).resolve().parent.parent.parent
        pyproject_path = root / "pyproject.toml"

        if not pyproject_path.exists():
            return default

        with pyproject_path.open("rb") as f:
            data = tomllib.load(f)

        value: Any = data
        for key in keys:
            if not isinstance(value, dict):
                return default
            value = value.get(key, default)
        return value
    except Exception:
        return default
