from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel
import re


# =====================================================
# ENUMS (PRODUCTION-GRADE)
# =====================================================

class Severity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class IssueCategory(str, Enum):
    INJECTION = "injection"
    XSS = "xss"
    AUTH = "auth"
    ACCESS_CONTROL = "access_control"
    CONFIGURATION = "configuration"
    RATE_LIMITING = "rate_limiting"
    LOGIC = "logic"
    CRYPTO = "crypto"
    SUPPLY_CHAIN = "supply_chain"
    UNKNOWN = "unknown"


# =====================================================
# MODELS
# =====================================================

class IssueInstance(BaseModel):
    path: str
    line: int
    code_snippet: str = ""


class NormalizedIssue(BaseModel):
    title: str
    original_rule: str
    ownership: str             # backend | frontend | infra | unknown
    issue_type: str            # security | logic | reliability | configuration
    severity: Severity
    evidence_level: str        # static_detected | runtime_confirmed | insufficient
    exploitability: str        # exploitable | theoretical | non_exploitable | unknown
    decision: str              # fix_now | backlog | ignore | review
    reason: str
    recommended_action: str
    instances: List[IssueInstance] = []
    source: str = "code"       # code | runtime


class Summary(BaseModel):
    overall_production_readiness: str
    total_raw_findings: int
    fix_now_count: int
    backlog_count: int
    posture: str               # good | moderate | weak


class NormalizedReport(BaseModel):
    summary: Summary
    issues: List[NormalizedIssue]


# =====================================================
# ENGINE
# =====================================================

class ReportNormalizer:
    def __init__(self, use_mongodb: bool = False):
        self.use_mongodb = use_mongodb



    def normalize(self, raw_issues: List[Any]) -> NormalizedReport:
        grouped: Dict[str, Dict[str, Any]] = {}

        for issue in raw_issues:
        
            # Handle both object and dict
            title = getattr(issue, "title", issue.get("title", "unknown") if isinstance(issue, dict) else "unknown")
            description = getattr(issue, "description", issue.get("description", "") if isinstance(issue, dict) else "")
            location = getattr(issue, "location", issue.get("location", "") if isinstance(issue, dict) else "")
            source = getattr(issue, "source", issue.get("source", "code") if isinstance(issue, dict) else "code")
            tool = getattr(issue, "tool", issue.get("tool", "unknown") if isinstance(issue, dict) else "unknown")
            snippet = getattr(issue, "code_snippet", "")
            if snippet is None:
                snippet = ""

            if title not in grouped:
                grouped[title] = {
                    "rule": title,
                    "description": description,
                    "source": source,
                    "tool": tool,
                    "instances": [],
                    "proof_exists": False
                }
            
            # Proof exists logic for ZAP
            if source == "runtime" and (snippet or "Evidence:" in description or "Proof:" in description):
                grouped[title]["proof_exists"] = True

            path, line = self._parse_location(location)
            grouped[title]["instances"].append(IssueInstance(path=path, line=line, code_snippet=snippet))

        normalized_issues: List[NormalizedIssue] = []
        for title, data in grouped.items():
            category = self._detect_category(title)
            issue = self._build_normalized_issue(title, category, data)
            normalized_issues.append(issue)

        return NormalizedReport(
            summary=self._calculate_summary(normalized_issues, len(raw_issues)),
            issues=normalized_issues
        )

    def _parse_location(self, location: str) -> tuple:
        if not location:
            return "unknown", 0
        parts = location.split(":")
        if len(parts) >= 2 and parts[-1].isdigit():
            return ":".join(parts[:-1]), int(parts[-1])
        return location, 0

    def _detect_category(self, title: str) -> IssueCategory:
        t = title.lower()
        if any(x in t for x in ["injection", "sql", "nosql", "command"]): return IssueCategory.INJECTION
        if "xss" in t or "cross-site scripting" in t: return IssueCategory.XSS
        if any(x in t for x in ["auth", "jwt", "session", "password"]): return IssueCategory.AUTH
        if "access control" in t or "authorization" in t: return IssueCategory.ACCESS_CONTROL
        if "rate limit" in t or "throttl" in t: return IssueCategory.RATE_LIMITING
        if any(x in t for x in ["config", "header", "ssl", "tls"]): return IssueCategory.CONFIGURATION
        if "crypto" in t: return IssueCategory.CRYPTO
        if "dependency" in t or "vulnerable package" in t: return IssueCategory.SUPPLY_CHAIN
        return IssueCategory.UNKNOWN

    def _classify_ownership(self, path: str) -> str:
        if not path or path == "unknown":
            return "unknown"
        p = path.lower()
        if any(x in p for x in ["/routes", "/controllers", "/core", "/services", "backend/"]):
            return "backend"
        if any(x in p for x in ["/views", ".ejs", ".html", "frontend/", "template"]):
            return "frontend"
        if any(x in p for x in [".env", "config/", "docker/", ".yaml", ".yml", "deployment"]):
            return "infra"
        return "unknown"

    def _map_severity(self, title: str, category: IssueCategory, exploitability: str) -> Severity:
        t = title.lower()
        # High Priority Mappings
        if "command injection" in t or "rce" in t: return Severity.HIGH
        if "sql injection" in t: return Severity.HIGH
        if "authentication bypass" in t or "auth bypass" in t: return Severity.HIGH
        if "stored xss" in t: return Severity.HIGH
        
        # Medium Priority Mappings
        if "reflected xss" in t: return Severity.MEDIUM
        if "rate limit" in t: return Severity.MEDIUM
        
        # Low Priority Mappings
        if "open redirect" in t: return Severity.LOW
        if "security header" in t or "missing header" in t: return Severity.LOW

        # Contextual Exploitability Adjustment
        if exploitability == "exploitable":
            return Severity.HIGH

        # Fallback Category Logic
        if category in [IssueCategory.INJECTION, IssueCategory.AUTH, IssueCategory.ACCESS_CONTROL]:
            return Severity.HIGH
        if category in [IssueCategory.XSS, IssueCategory.RATE_LIMITING]:
            return Severity.MEDIUM
        return Severity.LOW

    def _classify_evidence(self, source: str, tool: str, proof_exists: bool) -> str:
        if source == "runtime" and tool == "OWASP ZAP" and proof_exists:
            return "runtime_confirmed"
        if source == "code":
            return "static_detected"
        return "insufficient"

    def _build_normalized_issue(self, title: str, category: IssueCategory, data: Dict) -> NormalizedIssue:
        # Determine Ownership based on first instance
        primary_path = data["instances"][0].path if data["instances"] else "unknown"
        ownership = self._classify_ownership(primary_path)

        # Determine Evidence Level
        evidence_level = self._classify_evidence(data["source"], data["tool"], data["proof_exists"])

        # Determine Exploitability and Decision with safety nets
        exploitability = "unknown"
        decision = "review"

        if evidence_level == "runtime_confirmed":
            exploitability = "exploitable"
            decision = "fix_now"
        elif evidence_level == "static_detected":
            exploitability = "theoretical"
            decision = "backlog"

        # Severity Mapping
        severity = self._map_severity(title, category, exploitability)

        # Specific Overrides for Critical Decisions
        if severity == Severity.HIGH and exploitability == "exploitable":
            decision = "fix_now"
        elif severity == Severity.LOW:
            decision = "ignore"

        # Recommendation and Reason
        reason = f"Detected {category.value} via {data['tool']}. Evidence: {evidence_level}."
        action = f"Verify {category.value} in {ownership} layer and apply sanitization or configuration fix."

        return NormalizedIssue(
            title=title,
            original_rule=title,
            ownership=ownership,
            issue_type="security" if category != IssueCategory.CONFIGURATION else "configuration",
            severity=severity,
            evidence_level=evidence_level,
            exploitability=exploitability,
            decision=decision,
            reason=reason,
            recommended_action=action,
            instances=data["instances"],
            source=data["source"]
        )

    def _calculate_summary(self, issues: List[NormalizedIssue], total_raw: int) -> Summary:
        fix_now = len([i for i in issues if i.decision == "fix_now"])
        backlog = len([i for i in issues if i.decision == "backlog"])
        
        posture = "good"
        if fix_now > 5:
            posture = "weak"
        elif fix_now > 0 or backlog > 10:
            posture = "moderate"

        readiness = "Production Ready" if fix_now == 0 else "Needs Remediation"

        return Summary(
            overall_production_readiness=readiness,
            total_raw_findings=total_raw,
            fix_now_count=fix_now,
            backlog_count=backlog,
            posture=posture
        )
