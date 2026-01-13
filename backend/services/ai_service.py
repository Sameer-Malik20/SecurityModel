import logging
import json
from llm.client import LLMClient
from llm.prompts import SYSTEM_PROMPT, generate_user_prompt
from reports.report_normalizer import NormalizedReport

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.client = LLMClient()

    def enrich_report(self, report: NormalizedReport) -> NormalizedReport:
        """
        Iterates through actionable issues in the report and adds AI analysis/fixes.
        """
        logger.info("Starting AI Enrichment for Scan Report...")
        
        # We only look at actionable issues (High/Medium real vulnerabilities or potential risks)
        # We skip "Configuration" mostly unless requested, to save tokens.
        
        updated_issues = []
        
        for issue in report.issues:
            # Skip if no instances/code
            if not issue.instances:
                updated_issues.append(issue)
                continue
                
            # Skip architectural/info unless it's XSS/Injection
            if issue.severity == "INFO" and issue.risk_score < 5:
                updated_issues.append(issue)
                continue
            
            # Use the first instance for analysis (MVP limitation)
            snippet = issue.instances[0].code_snippet
            if not snippet:
                updated_issues.append(issue)
                continue
                
            # Call LLM
            prompt = generate_user_prompt(issue.model_dump(), snippet)
            response = self.client.chat_completion(SYSTEM_PROMPT, prompt)
            
            if response.get("content"):
                try:
                    # Clean JSON if LLM added markdown
                    raw_content = response["content"].strip()
                    if raw_content.startswith("```json"):
                        raw_content = raw_content[7:]
                    if raw_content.endswith("```"):
                        raw_content = raw_content[:-3]
                        
                    ai_data = json.loads(raw_content)
                    
                    # Update Issue with AI Insights
                    # We'll prepend AI advice to recommended_action or a new field
                    # Since NormalizedIssue is strict, we might append to recommended_action 
                    # or strictly, we should have added an 'ai_analysis' field to the model.
                    # For now, I will append to recommended_action to avoid schema breaking changes without refactoring Normalizer.
                    
                    details = (
                        f"\n\n[AI SUGGESTION]\n"
                        f"Analysis: {ai_data.get('analysis')}\n"
                        f"Explanation: {ai_data.get('explanation')}\n"
                        f"Fix:\n```javascript\n{ai_data.get('fix_code')}\n```"
                    )
                    issue.recommended_action += details
                    
                except json.JSONDecodeError:
                    logger.warning("Failed to parse LLM JSON response.")
                    issue.recommended_action += f"\n\n[AI RAW ADVICE]\n{response['content']}"
            
            updated_issues.append(issue)
            
        report.issues = updated_issues
        return report
