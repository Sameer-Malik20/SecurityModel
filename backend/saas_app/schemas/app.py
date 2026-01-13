from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    repo_url: str
    deploy_url: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None
    deploy_url: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: str
    owner_id: Optional[str] = None
    
    class Config:
        from_attributes = True

class ScanCreate(BaseModel):
    project_id: str
    report_data: Any # JSON

class ScanResponse(BaseModel):
    id: str
    project_id: str
    created_at: datetime
    report_json: str # Serialized JSON string
    status: str = "completed" # completed, pending, failed
    logs: List[str] = []
    raw_reports: Optional[dict] = None # Original outputs from Semgrep/CodeQL/etc.
    
    class Config:
        from_attributes = True
