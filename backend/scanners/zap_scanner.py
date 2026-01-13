import json
import logging
import os
import tempfile
import shutil
from utils.command_runner import CommandRunner
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ZapScanner:
    def __init__(self):
        self.runner = CommandRunner()

    def scan(self, target_url: str) -> Dict[str, Any]:
        """
        Runs OWASP ZAP Baseline scan via Docker.
        """
        logger.info(f"Starting OWASP ZAP scan on {target_url}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            report_name = "zap_report.json"
            
            # Inside our unified docker image, zap-baseline.py is in /zap/
            # We try the absolute path first as it's the most reliable in our Dockerfile setup
            zap_script = "/zap/zap-baseline.py"
            
            if os.path.exists(zap_script):
                logger.info("ZAP baseline script found at /zap/zap-baseline.py")
                # Direct execution inside the container
                cmd = [
                    "python3", zap_script,
                    "-t", target_url,
                    "-J", report_name,
                    "-sort", "false" # Some versions need this to avoid extra processing
                ]
            elif shutil.which("zap-baseline.py"):
                logger.info("ZAP baseline script found in PATH")
                cmd = [
                    "zap-baseline.py",
                    "-t", target_url,
                    "-J", report_name
                ]
            else:
                logger.warning("ZAP baseline script not found in standard container paths. Falling back to Docker-run.")
                # Fallback to Docker if running locally on dev machine
                cmd = [
                    "docker", "run",
                    "--rm",
                    "-v", f"{temp_dir}:/zap/wrk/:rw",
                    "ghcr.io/zaproxy/zaproxy:stable",
                    "zap-baseline.py",
                    "-t", target_url,
                    "-J", report_name 
                ]
            
            logger.info(f"Executing ZAP command: {' '.join(cmd)}")
            code, out, err = self.runner.run_command(cmd, cwd=temp_dir)
            
            if code != 0:
                logger.error(f"ZAP failed with code {code}")
                logger.error(f"ZAP Output: {out}")
                logger.error(f"ZAP Error: {err}")
            else:
                logger.info("ZAP command executed successfully.")
            
            report_path = os.path.join(temp_dir, report_name)
            if not os.path.exists(report_path):
                logger.error("ZAP report not found.")
                return {}
                
            try:
                with open(report_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to parse ZAP report: {e}")
                return {}
