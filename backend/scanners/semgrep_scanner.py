import json
import logging
import os
import shutil
import subprocess
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class SemgrepScanner:
    def __init__(self):
        self.binary = self._find_semgrep()

    # ---------------------------------------------------------
    # Auto-detect Semgrep binary safely
    # ---------------------------------------------------------
    def _find_semgrep(self) -> Optional[str]:
        """
        Safely detect Semgrep binary.
        Works on Windows, Linux, Mac. 
        """
        possible_bins = ["semgrep", "semgrep.exe"]

        for b in possible_bins:
            path = shutil.which(b)
            if path:
                logger.info(f"Semgrep found: {path}")
                return path

        logger.error("Semgrep is NOT installed or not in PATH.")
        return None

    # ---------------------------------------------------------
    # Run a subprocess and capture output
    # ---------------------------------------------------------
    def _run(self, cmd: List[str], cwd: str) -> (int, str, str):
        """
        Runs a command and returns (exit_code, stdout, stderr)
        """
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8"
            )
            out, err = proc.communicate()
            return proc.returncode, out, err

        except Exception as e:
            return 999, "", f"Failed to start Semgrep: {str(e)}"

    # ---------------------------------------------------------
    # Main Scan Function
    # ---------------------------------------------------------
    def scan(self, target_path: str) -> Dict[str, Any]:
        """
        Run Semgrep scan using recommended configs.
        Returns a dictionary with results, errors, status.
        """

        logger.info(f"Starting Semgrep scan on: {target_path}")

        # 1. Binary check
        if not self.binary:
            return {
                "status": "error",
                "error": "Semgrep binary not found in PATH",
                "results": []
            }

        # 2. Output location
        output_file = os.path.join(target_path, "semgrep_results.json")

        # Ensure no old report stays
        if os.path.exists(output_file):
            os.remove(output_file)

        # 3. Semgrep command (stable cross-platform version)
        cmd = [
            self.binary, "scan",
            "--config", "p/ci",                # Best dynamic config
            "--json",
            "--no-git-ignore",
            "--disable-version-check",
            "--jobs", "1",                    # Stable on Windows
            "-o", output_file,
            target_path
        ]

        logger.info(f"Running Semgrep Command: {' '.join(cmd)}")

        # 4. Execute command
        code, out, err = self._run(cmd, cwd=target_path)

        # 5. If fail, log and return
        if code != 0:
            logger.error(f"Semgrep Failed. Exit Code: {code}\nSTDOUT:\n{out}\nSTDERR:\n{err}")

            return {
                "status": "failed",
                "exit_code": code,
                "stdout": out,
                "stderr": err,
                "results": []
            }

        # 6. Read JSON output
        if not os.path.exists(output_file):
            logger.error("Semgrep did not produce any output JSON file.")

            return {
                "status": "failed",
                "exit_code": code,
                "stdout": out,
                "stderr": err,
                "results": []
            }

        try:
            with open(output_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            return {
                "status": "success",
                "results": data
            }

        except Exception as e:
            logger.error(f"Failed to parse Semgrep JSON: {str(e)}")

            return {
                "status": "failed",
                "error": str(e),
                "results": []
            }
