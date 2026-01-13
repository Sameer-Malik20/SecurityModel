from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class Project(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    repo_url: str
    owner_email: str

class Scan(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    project_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    report_json: Optional[str] = None
