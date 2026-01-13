from typing import List, Dict, Any
from models import ScanReport, ScanSummary, ScanIssue, Severity, ScanTool, IssueType
import logging

logger = logging.getLogger(__name__)

class ReportBuilder:
    """
    Normalizes raw findings from different tools into a single JSON report.
    """

    def __init__(self):
        self.issues: List[ScanIssue] = []
        self.repo_scanned = False
        self.deploy_scanned = False
        self.tools_used = set()

    def add_custom_issue(self, title: str, description: str, severity: Severity = Severity.INFO):
        """
        Adds a custom or configuration-detected issue/info.
        """
        self.tools_used.add(ScanTool.CONFIG_CHECK)
        self.repo_scanned = True 
        
        self.issues.append(ScanIssue(
            source="code",
            tool=ScanTool.CONFIG_CHECK,
            type=IssueType.LOGIC_BUG if severity == Severity.INFO else IssueType.SECURITY_VULNERABILITY,
            severity=severity,
            title=title,
            description=description,
            location="Configuration/Dependencies"
        ))

    def add_semgrep_results(self, raw_json: Any):
        """
        Parses Semgrep JSON output.
        """
        self.tools_used.add(ScanTool.SEMGREP)
        self.repo_scanned = True
        
        results = []
        if isinstance(raw_json, dict):
            results = raw_json.get('results', [])
        elif isinstance(raw_json, list):
            results = raw_json
        else:
            logger.warning(f"Unexpected Semgrep output format: {type(raw_json)}")
            return
        for res in results:
            if not isinstance(res, dict):
                continue

            severity_map = {
                "ERROR": Severity.HIGH,
                "WARNING": Severity.MEDIUM,
                "INFO": Severity.LOW
            }
            # Semgrep severity is typically ERROR, WARNING, INFO
            raw_sev = res.get('extra', {}).get('severity', 'WARNING')
            
            self.issues.append(ScanIssue(
                source="code",
                tool=ScanTool.SEMGREP,
                type=IssueType.LOGIC_BUG if "correctness" in res.get('check_id', '') else IssueType.SECURITY_VULNERABILITY,
                severity=severity_map.get(raw_sev, Severity.MEDIUM),
                title=res.get('check_id', 'Unknown Issue'),
                description=res.get('extra', {}).get('message', 'No description'),
                location=f"{res.get('path')}:{res.get('start', {}).get('line')}"
            ))

    def add_codeql_results(self, raw_json: Any):
        """
        Parses CodeQL SARIF or CSV - wait, the requirement asks for JSON output. 
        CodeQL 'database analyze' with '--format=sarif-latest' produces JSON-like SARIF.
        Assuming we parse SARIF json structure here.
        """
        self.tools_used.add(ScanTool.CODEQL)
        self.repo_scanned = True

        runs = []
        if isinstance(raw_json, dict):
            runs = raw_json.get('runs', [])
        elif isinstance(raw_json, list):
            # Sometimes CodeQL might return a list of SARIF objects if we aggregate them,
            # or maybe it's just the 'runs' list directly if something pre-processed it.
            # But standard SARIF is a dict with 'runs'.
            # If `raw_json` is a list, let's assume it's a list of run objects or list of sarif objects.
            # Let's handle it safely.
            # If list item 0 has 'runs', it's a list of SARIFs.
            # If list item 0 has 'tool', it's a list of runs.
            if raw_json and isinstance(raw_json[0], dict):
                if 'runs' in raw_json[0]:
                    for item in raw_json:
                        if isinstance(item, dict):
                            runs.extend(item.get('runs', []))
                else:
                    runs = raw_json
        else:
             logger.warning(f"Unexpected CodeQL output format: {type(raw_json)}")
             return
            
        for run in runs:
            results = run.get('results', [])
            rules = {r['id']: r for r in run.get('tool', {}).get('driver', {}).get('rules', [])}
            
            for res in results:
                rule_id = res.get('ruleId')
                rule_info = rules.get(rule_id, {})
                
                # Default severity mapping
                # SARIF uses 'level': 'error', 'warning', 'note'
                level = res.get('level', 'warning')
                if level == 'error':
                    sev = Severity.HIGH
                elif level == 'note':
                    sev = Severity.LOW
                else:
                    sev = Severity.MEDIUM

                # Location
                loc = "Unknown"
                locations = res.get('locations', [])
                if locations:
                    phy_loc = locations[0].get('physicalLocation', {})
                    uri = phy_loc.get('artifactLocation', {}).get('uri', '')
                    line = phy_loc.get('region', {}).get('startLine', 0)
                    loc = f"{uri}:{line}"

                self.issues.append(ScanIssue(
                    source="code",
                    tool=ScanTool.CODEQL,
                    type=IssueType.SECURITY_VULNERABILITY,
                    severity=sev,
                    title=rule_id,
                    description=res.get('message', {}).get('text', rule_info.get('shortDescription', {}).get('text', '')),
                    location=loc
                ))

    def add_zap_results(self, raw_json: Dict[str, Any]):
        """
        Parses OWASP ZAP (JSON) output.
        """
        self.tools_used.add(ScanTool.OWASP_ZAP)
        self.deploy_scanned = True

        # ZAP JSON output has 'site' -> alerts
        site_list = raw_json.get('site', [])
        for site in site_list:
            alerts = site.get('alerts', [])
            for alert in alerts:
                # ZAP Risk codes: 0=Info, 1=Low, 2=Medium, 3=High
                risk_code = alert.get('riskcode', '1')
                risk_map = {
                    '3': Severity.HIGH,
                    '2': Severity.MEDIUM,
                    '1': Severity.LOW,
                    '0': Severity.INFO
                }
                
                # Capture evidence for runtime confirmation
                evidence = alert.get('evidence', '')
                other = alert.get('other', '')
                snippet = f"Evidence: {evidence}\nOther: {other}" if evidence or other else ""
                
                self.issues.append(ScanIssue(
                    source="runtime",
                    tool=ScanTool.OWASP_ZAP,
                    type=IssueType.RUNTIME_ISSUE,
                    severity=risk_map.get(risk_code, Severity.LOW),
                    title=alert.get('alert', 'Unknown Alert'),
                    description=alert.get('description', ''),
                    location=f"{alert.get('method', 'GET')} {alert.get('url', '')}",
                    code_snippet=snippet
                ))



    def add_gospider_results(self, urls: List[str]):
        """
        Adds Gospider findings as Info/Discovery items.
        """
        self.tools_used.add(ScanTool.GOSPIDER)
        self.deploy_scanned = True
        
        # We don't want to flood the report with every URL, but maybe summarize or list them?
        # For now, let's treat them as an aggregate info or just list them if valid.
        # User asked for "fully working" tools. Listing unique "interesting" URLs might be better.
        # But let's just add one "Discovery" issue containing the list, or individual items?
        # Individual items might be too many (thousands).
        # Let's add a single "Url Discovery Summary" issue.
        
        if not urls:
            return

        preview = "\n".join(urls[:20])
        count = len(urls)
        msg = f"Gospider discovered {count} URLs. First 20:\n{preview}"
        if count > 20: 
            msg += f"\n...and {count-20} more."

        self.issues.append(ScanIssue(
            source="runtime",
            tool=ScanTool.GOSPIDER,
            type=IssueType.RUNTIME_ISSUE,
            severity=Severity.INFO,
            title="Sitemap Discovery",
            description="The spider successfully crawled the target and discovered accessible endpoints.",
            location="Target Scope",
            code_snippet=msg
        ))

    def build_report(self) -> ScanReport:
        return ScanReport(
            summary=ScanSummary(
                repo_scanned=self.repo_scanned,
                deploy_scanned=self.deploy_scanned,
                tools_used=list(self.tools_used),
                total_issues=len(self.issues)
            ),
            issues=self.issues
        )
