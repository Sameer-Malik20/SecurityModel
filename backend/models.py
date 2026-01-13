from pydantic import BaseModel, HttpUrl, root_validator
from typing import Optional, List, Literal
from enum import Enum

class ScanTarget(BaseModel):
    repo_url: Optional[str] = None
    deploy_url: Optional[str] = None

    @root_validator(pre=True)
    def check_at_least_one(cls, values):
        repo_url = values.get('repo_url')
        deploy_url = values.get('deploy_url')
        if not repo_url and not deploy_url:
            raise ValueError('At least one of repo_url or deploy_url is required.')
        return values

class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    INFO = "Info"

class ScanTool(str, Enum):
    CODEQL = "CodeQL"
    SEMGREP = "Semgrep"
    OWASP_ZAP = "OWASP ZAP"
    GOSPIDER = "Gospider"
    CONFIG_CHECK = "Config Check"

class IssueType(str, Enum):
    LOGIC_BUG = "Logic Bug"
    SECURITY_VULNERABILITY = "Security Vulnerability"
    RUNTIME_ISSUE = "Runtime Issue"

class ScanIssue(BaseModel):
    source: Literal["code", "runtime"]
    tool: ScanTool
    type: IssueType
    severity: Severity
    title: str
    description: str
    location: str
    code_snippet: Optional[str] = None

class ScanSummary(BaseModel):
    repo_scanned: bool
    deploy_scanned: bool
    tools_used: List[ScanTool]
    total_issues: int

class ScanReport(BaseModel):
    summary: ScanSummary
    issues: List[ScanIssue]
