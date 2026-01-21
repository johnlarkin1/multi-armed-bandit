from pydantic import BaseModel, Field, field_validator


class RootRequest(BaseModel):
    id: str = Field(..., description="id of request", min_length=24, max_length=24)

    @field_validator("id")
    def validate_id(cls, v: str) -> str:
        if len(v) != 24:
            raise ValueError("need 24 char length")
        if not v.isalnum():
            raise ValueError("need alphanumeric")
        return v


class RootResponse(BaseModel):
    status: str = "ok"
