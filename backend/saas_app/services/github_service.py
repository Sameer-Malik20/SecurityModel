import requests
import base64
import logging

logger = logging.getLogger(__name__)

class GitHubService:
    @staticmethod
    def get_file_content(token: str, repo_url: str, file_path: str) -> str:
        """
        Fetches file content from GitHub API.
        repo_url expected format: https://github.com/owner/repo or owner/repo
        """
        if not token:
            raise ValueError("No GitHub token provided")
            
        # Parse owner/repo
        if "github.com/" in repo_url:
            parts = repo_url.split("github.com/")[-1].replace(".git", "").split("/")
        else:
            parts = repo_url.split("/")
            
        if len(parts) < 2:
            raise ValueError("Invalid Repository URL format")
            
        owner, repo = parts[0], parts[1]
        
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            logger.error(f"GitHub API Error: {resp.status_code} - {resp.text}")
            return None
            
        data = resp.json()
        if "content" not in data:
            return None
            
        try:
            content = base64.b64decode(data["content"]).decode('utf-8')
            return content
        except Exception as e:
            logger.error(f"Decoding failed: {e}")
            return None

    @staticmethod
    def extract_snippet(full_content: str, line_number: int, context: int = 20) -> str:
        if not full_content:
            return ""
            
        lines = full_content.splitlines()
        total_lines = len(lines)
        
        start = max(0, line_number - 1 - context)
        end = min(total_lines, line_number + context)
        
        snippet = []
        for i in range(start, end):
            prefix = ">> " if (i + 1) == line_number else "   "
            snippet.append(f"{prefix}{i+1}: {lines[i]}")
            
        return "\n".join(snippet)
