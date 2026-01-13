import logging
import tempfile
import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from typing import List
from models import ScanReport, ScanTarget, Severity, ScanIssue
from scanners.semgrep_scanner import SemgrepScanner
from scanners.codeql_scanner import CodeQLScanner
from reports.report_builder import ReportBuilder
from reports.report_normalizer import ReportNormalizer
from utils.command_runner import CommandRunner
from scanners.zap_scanner import ZapScanner

logger = logging.getLogger(__name__)

class ScanJob:
    """
    Orchestrates the security scan pipeline.
    """
    def __init__(self, request: ScanTarget, log_callback=None, github_token=None):
        self.request = request
        self.runner = CommandRunner()
        self.builder = ReportBuilder()
        self.use_mongodb = False
        self.log_callback = log_callback
        self.github_token = github_token

    def _log(self, message: str):
        logger.info(message)
        if self.log_callback:
            self.log_callback(message)

    def run(self):
        """
        Executes the scan pipeline sequentially.
        """
        self._log("Starting security scan pipeline...")
        
        work_dir = tempfile.mkdtemp()
        try:
            self._log(f"Initialized temporary environment: {work_dir}")
            
            # 1. Clone Repo if exists
            if self.request.repo_url:
                self._log(f"Cloning repository: {self.request.repo_url}")
                self._clone_repo(self.request.repo_url, work_dir)
                repo_path = os.path.join(work_dir, "repo")
                
                # 2. Tech Stack Check
                if os.path.exists(repo_path):
                    self._log("Analyzing project technology stack...")
                    self._check_tech_stack(repo_path)
                    
                    # 3. Run Semgrep
                    self._log("Executing Static Analysis (Semgrep)...")
                    semgrep_res = SemgrepScanner().scan(repo_path)
                    self.builder.add_semgrep_results(semgrep_res)
                    
                    # 4. Run CodeQL
                    self._log("Executing Advanced Static Analysis (CodeQL)...")
                    codeql_res = CodeQLScanner().scan(repo_path)
                    for res in codeql_res:
                        self.builder.add_codeql_results(res)
                else:
                    self._log("CRITICAL: Repo path does not exist, skipping static analysis.")

            # 5. Run ZAP if exists
            if self.request.deploy_url:
                self._log(f"Executing Dynamic Analysis (OWASP ZAP) on {self.request.deploy_url}...")
                zap_res = ZapScanner().scan(self.request.deploy_url)
                self.builder.add_zap_results(zap_res)

            # 6. Extract Raw Evidence (NEW)
            raw_report = self.builder.build_report()
            if self.request.repo_url and os.path.exists(os.path.join(work_dir, "repo")):
                self._log("Extracting code snippets for all tool findings...")
                self._extract_raw_snippets(raw_report.issues, os.path.join(work_dir, "repo"))

            # 6. AI REPORT SYNTHESIS (NEW)
            self._log("Synthesizing perfect security report using AI...")
            from saas_app.services.llm_service import LLMService
            llm = LLMService()
            
            # Prepare data for LLM
            sanitized_findings = []
            for issue in raw_report.issues:
                issue_dict = issue.dict()
                if issue_dict.get('code_snippet') is None:
                    issue_dict['code_snippet'] = ""
                sanitized_findings.append(issue_dict)

            llm_payload = {
                "status": "success",
                "tool_summary": {
                    "tools": [t.value for t in raw_report.summary.tools_used],
                    "total_raw_findings": raw_report.summary.total_issues
                },
                "raw_findings": sanitized_findings
            }
            
            normalized_report = llm.generate_perfect_report(llm_payload)
            
            # Prepare Raw Reports Dictionary for storage
            raw_reports_dump = {
                "semgrep": semgrep_res if 'semgrep_res' in locals() else None,
                "codeql": codeql_res if 'codeql_res' in locals() else [],
                "zap": zap_res if 'zap_res' in locals() else {}
            }

            # Check for AI Errors
            if "error" in normalized_report:
                self._log(f"AI Reporting failed: {normalized_report['error']}")
                self._log("Falling back to legacy normalization...")
                from reports.report_normalizer import ReportNormalizer
                normalizer = ReportNormalizer(use_mongodb=self.use_mongodb)
                final_report = normalizer.normalize(raw_report.issues)
                return {
                    "ai_enhanced": final_report,
                    "raw": raw_reports_dump
                }

            self._log("AI Audit complete. Generating final insights.")
            return {
                "ai_enhanced": normalized_report,
                "raw": raw_reports_dump
            }
            
        except Exception as e:
            self._log(f"ERROR: Scan job failed - {str(e)}")
            raise e
        finally:
            try:
                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception:
                pass

    def _extract_raw_snippets(self, issues: List[ScanIssue], repo_path: str):
        """
        Populates code_snippet for raw ScanIssue list.
        """
        for issue in issues:
            if not issue.location or issue.source != "code":
                continue
            
            parts = issue.location.split(":")
            if len(parts) >= 2 and parts[-1].isdigit():
                path = ":".join(parts[:-1])
                line = int(parts[-1])
            else:
                continue
                
            full_path = os.path.join(repo_path, path)
            if os.path.exists(full_path):
                try:
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                        start = max(0, line - 15) # Smaller window for raw dump
                        end = min(len(lines), line + 15)
                        
                        snippet_lines = []
                        for idx in range(start, end):
                            snippet_lines.append(f"{idx+1:3} | {lines[idx]}")
                        
                        issue.code_snippet = "".join(snippet_lines)
                except Exception:
                    pass

    def _clone_repo(self, url: str, work_dir: str):
        """
        Clones the repository.
        """
        target_dir = os.path.join(work_dir, "repo")
        
        # Use token if available
        if self.github_token and "github.com" in url:
            # https://<token>@github.com/user/repo.git
            url = url.replace("https://", f"https://{self.github_token}@")

        cmd = ["git", "clone", "--depth", "1", url, target_dir]
        
        code, _, err = self.runner.run_command(cmd, cwd=work_dir)
        if code != 0:
            logger.error(f"Failed to clone repo: {err}")


    def _check_tech_stack(self, repo_path: str):
        """
        Checks for specific technologies like MongoDB to aid the LLM.
        """
        mongo_indicators = ["pymongo", "motor", "mongoengine", "mongodb", "mongoose"]
        found_mongo = False
        
        try:
            for root, dirs, files in os.walk(repo_path):
                # Optimize: don't go too deep or into node_modules/venv
                if "node_modules" in dirs:
                    dirs.remove("node_modules")
                if "venv" in dirs:
                    dirs.remove("venv")
                if ".git" in dirs:
                    dirs.remove(".git")
                    
                check_files = [f for f in files if f in ["requirements.txt", "package.json", "Pipfile"]]
                
                for f in check_files:
                    path = os.path.join(root, f)
                    try:
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f_obj:
                            content = f_obj.read().lower()
                            if any(ind in content for ind in mongo_indicators):
                                found_mongo = True
                                break
                    except Exception:
                        continue
                
                if found_mongo:
                    break
            
            if found_mongo:
                self.use_mongodb = True
                logger.info("MongoDB Detected in project dependencies.")
                self.builder.add_custom_issue(
                    title="Technology Detected: MongoDB",
                    description="The codebase indicates the usage of MongoDB (detected via dependencies like pymongo, mongoose, etc.). ensuring the analysis context is aware of NoSQL usage.",
                    severity=Severity.INFO
                )
        except Exception as e:
            logger.error(f"Error checking tech stack: {e}")
