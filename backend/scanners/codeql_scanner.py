import json
import logging
import os
import shutil
from utils.command_runner import CommandRunner
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class CodeQLScanner:
    def __init__(self):
        self.runner = CommandRunner()

    # ----------------------------------------
    # 1. AUTO LANGUAGE DETECTION (Production)
    # ----------------------------------------
    def detect_languages(self, path: str) -> List[str]:
        extensions = {
            "javascript": [".js", ".jsx", ".ts", ".tsx"],
            "python": [".py"],
            "java": [".java"],
            "go": [".go"],
            "csharp": [".cs"],
            "ruby": [".rb"]
        }

        detected = set()

        for root, _, files in os.walk(path):
            for file in files:
                for lang, exts in extensions.items():
                    if any(file.endswith(ext) for ext in exts):
                        detected.add(lang)

        return list(detected)

    # ----------------------------------------
    # 2. GET CORRECT CODEQL QUERY PACK
    # ----------------------------------------
    def get_query_pack(self, lang: str) -> str:
        packs = {
            "javascript": "codeql/javascript-queries",
            "python": "codeql/python-queries",
            "java": "codeql/java-queries",
            "go": "codeql/go-queries",
            "csharp": "codeql/csharp-queries",
            "ruby": "codeql/ruby-queries"
        }
        return packs.get(lang)

    # ----------------------------------------
    # 3. RUN PRODUCTION CODEQL SCAN
    # ----------------------------------------
    def scan(self, target_path: str) -> List[Dict[str, Any]]:
        logger.info(f"Starting CodeQL scan on: {target_path}")

        # Auto detect languages
        languages = self.detect_languages(target_path)

        if not languages:
            logger.warning("No supported languages detected.")
            return []

        logger.info(f"Detected languages: {languages}")

        all_results = []

        for lang in languages:
            logger.info(f"Running CodeQL for language: {lang}")

            pack = self.get_query_pack(lang)
            if not pack:
                logger.warning(f"No CodeQL queries available for {lang}")
                continue

            db_path = os.path.join(target_path, f"codeql_db_{lang}")
            report_file = os.path.join(target_path, f"codeql_report_{lang}.sarif")

            if os.path.exists(db_path):
                shutil.rmtree(db_path)

            # Create DB
            create_cmd = [
                "codeql", "database", "create",
                db_path,
                "--source-root", target_path,
                f"--language={lang}",
                "--overwrite",
                "--ram=4000"
            ]
            code, out, err = self.runner.run_command(create_cmd, cwd=target_path)
            if code != 0:
                logger.error(f"DB creation failed for {lang}: {err}")
                continue

            # Analyze
            analyze_cmd = [
                "codeql", "database", "analyze",
                db_path,
                pack,
                "--format=sarif-latest",
                f"--output={report_file}",
                "--ram=4000",
            ]
            code, out, err = self.runner.run_command(analyze_cmd, cwd=target_path)
            if code != 0:
                logger.error(f"CodeQL analysis failed for {lang}: {err}")
                continue

            # Parse output
            try:
                with open(report_file, "r", encoding="utf-8") as f:
                    all_results.append(json.load(f))
            except Exception as e:
                logger.error(f"Failed to load SARIF for {lang}: {e}")

        return all_results
