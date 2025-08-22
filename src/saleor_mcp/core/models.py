from pydantic import BaseModel, Field


class SaleorRequest(BaseModel):
    saleor_api_url: str = Field(
        description="The URL of the Saleor GraphQL API (e.g., 'https://your-saleor-instance.com/graphql/')"
    )
    authentication_token: str = Field(
        description="Valid authentication token for the Saleor GraphQL API"
    )


class MCPErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
