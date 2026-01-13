from scan_job import ScanJob
from models import ScanTarget
import os

target = ScanTarget(
    repo_url=os.getenv("REPO_URL"),
    deploy_url=os.getenv("DEPLOY_URL")
)

job = ScanJob(target, github_token=os.getenv("GITHUB_TOKEN"))
result = job.run()

print("FULL SECURITY PIPELINE DONE")
