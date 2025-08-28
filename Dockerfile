FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files and source code
COPY . /app

# Install dependencies
RUN uv sync --locked

# Expose port
EXPOSE 8000

LABEL org.opencontainers.image.title="saleor/saleor-mcp" \
    org.opencontainers.image.description="A Model Context Protocol (MCP) server for Saleor Commerce" \
    org.opencontainers.image.url="https://saleor.io/" \
    org.opencontainers.image.source="https://github.com/saleor/saleor-mcp" \
    org.opencontainers.image.authors="Saleor Commerce (https://saleor.io)" \
    org.opencontainers.image.licenses="AGPL-3.0"

# Run the application
CMD ["uv", "run", "uvicorn", "saleor_mcp.main:app", "--host", "0.0.0.0", "--port", "8000"]
