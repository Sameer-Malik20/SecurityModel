from fastapi import APIRouter, HTTPException, BackgroundTasks
from models import ScanTarget, ScanReport
from jobs.scan_job import ScanJob
import logging
import threading

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/scan", response_model=ScanReport)
def run_scan(request: ScanTarget):
    """
    Trigger a security scan.
    This endpoint blocks until the scan is complete and returns the report.
    For production with long scans, this should be async with polling, 
    but for this task we return the report directly.
    """
    logger.info(f"Received scan request: {request}")
    
    # Run in a separate thread to ensure main loop isn't blocked if using async (though we are blocking here)
    # or simply run directly. The prompt requirement "Background execution using threading" might imply 
    # we should offload the work.
    # Since we need to return the value, we can use a Future or just run synchronously 
    # but strictly speaking FastAPI runs sync functions in a threadpool.
    # So we simply call the job.
    
    try:
        job = ScanJob(request)
        report = job.run()
        return report
    except Exception as e:
        logger.exception("Scan failed")
        raise HTTPException(status_code=500, detail=str(e))
