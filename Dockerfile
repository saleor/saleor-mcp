# Build and install packages
FROM python:3.12 AS build-python

WORKDIR /app
COPY \
  --from=ghcr.io/astral-sh/uv:0.11.8@sha256:3b7b60a81d3c57ef471703e5c83fd4aaa33abcd403596fb22ab07db85ae91347 \
  /uv /uvx /bin/
ENV UV_PROJECT_ENVIRONMENT=/usr/local

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

# Final image
FROM python:3.12-slim

COPY --from=build-python /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=build-python /usr/local/bin/ /usr/local/bin/
COPY . /app
WORKDIR /app

EXPOSE 8000

LABEL org.opencontainers.image.title="saleor/saleor-mcp" \
    org.opencontainers.image.description="A Model Context Protocol (MCP) server for Saleor Commerce" \
    org.opencontainers.image.url="https://saleor.io/" \
    org.opencontainers.image.source="https://github.com/saleor/saleor-mcp" \
    org.opencontainers.image.authors="Saleor Commerce (https://saleor.io)" \
    org.opencontainers.image.licenses="AGPL-3.0"

ENTRYPOINT ["uvicorn", "saleor_mcp.main:app", "--host=0.0.0.0", "--port=8000"]
