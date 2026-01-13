from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr
    hashed_password: str
    github_token_encrypted: Optional[str] = None

class Project(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    repo_url: str
    owner_email: str  # We'll use email as reference or ID string

class Scan(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    project_id: str
    created_at: str
    report_json: Optional[str] = None
