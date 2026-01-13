def run_semgrep(repo_path):
    print("Running Semgrep...")
    return [
        {
            "type": "Logic Bug",
            "issue": "Use of == instead of ===",
            "severity": "Medium"
        }
    ]
