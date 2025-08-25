from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    SALEOR_AUTH_TOKEN: str
    SALEOR_API_URL: str


settings = Settings()
