from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List
import json
import os
from bson import ObjectId

from ..schemas import app as schema
from ..core import security
from .deps import get_db, get_current_user
from ..services.github_service import GitHubService
from ..services.llm_service import LLMService
from ..services.prompts import generate_user_prompt
from jobs.scan_job import ScanJob
from models import ScanTarget

router = APIRouter()
llm_service = LLMService()

def fix_id(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

# --- PROJECTS ---

@router.post("/projects", response_model=schema.ProjectResponse)
async def create_project(item: schema.ProjectCreate, current_user = Depends(get_current_user), db = Depends(get_db)):
    project_dict = {
        "name": item.name,
        "repo_url": item.repo_url,
        "deploy_url": item.deploy_url,
        "owner_id": str(current_user["_id"])
    }
    result = await db.projects.insert_one(project_dict)
    project_dict["_id"] = result.inserted_id
    return fix_id(project_dict)

@router.get("/projects", response_model=List[schema.ProjectResponse])
async def get_projects(current_user = Depends(get_current_user), db = Depends(get_db)):
    cursor = db.projects.find({"owner_id": str(current_user["_id"])})
    projects = await cursor.to_list(length=100)
    return [fix_id(p) for p in projects]

@router.get("/projects/{project_id}", response_model=schema.ProjectResponse)
async def get_project(project_id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return fix_id(project)

@router.put("/projects/{project_id}", response_model=schema.ProjectResponse)
async def update_project(project_id: str, item: schema.ProjectUpdate, current_user = Depends(get_current_user), db = Depends(get_db)):
    update_data = {k: v for k, v in item.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided for update")
    
    result = await db.projects.find_one_and_update(
        {"_id": ObjectId(project_id), "owner_id": str(current_user["_id"])},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    return fix_id(result)

@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    # Also delete associated scans
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.scans.delete_many({"project_id": project_id})
    await db.projects.delete_one({"_id": ObjectId(project_id)})
    return {"message": "Project and associated scans deleted"}

# --- SCANS ---

@router.post("/projects/{project_id}/scans", response_model=schema.ScanResponse)
async def create_scan(project_id: str, scan_in: schema.ScanCreate, current_user = Depends(get_current_user), db = Depends(get_db)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    report_json = json.dumps(scan_in.report_data)
    
    scan_dict = {
        "project_id": project_id,
        "report_json": report_json,
        "created_at": security.datetime.utcnow()
    }
    result = await db.scans.insert_one(scan_dict)
    scan_dict["_id"] = result.inserted_id
    return fix_id(scan_dict)

async def run_scan_task(scan_id: str, project_id: str, repo_url: str, deploy_url: str = None, github_token: str = None):
    from ..core.database import db
    from concurrent.futures import ThreadPoolExecutor
    import asyncio


    main_loop = asyncio.get_event_loop()

    def update_logs_sync(msg):
        async def do_update():
            try:
                await db.scans.update_one(
                    {"_id": ObjectId(scan_id)},
                    {"$push": {"logs": msg}}
                )
            except Exception:
                pass

        main_loop.call_soon_threadsafe(
            lambda: asyncio.create_task(do_update())
        )

    async def perform_scan():
        try:
            target = ScanTarget(repo_url=repo_url, deploy_url=deploy_url)
            with ThreadPoolExecutor() as executor:
                job = ScanJob(target, log_callback=update_logs_sync, github_token=github_token)
                report = await main_loop.run_in_executor(executor, job.run)
            
            ai_data = report.get("ai_enhanced", {})
            raw_data = report.get("raw", {})

            report_json = ""
            if hasattr(ai_data, 'model_dump_json'):
                report_json = ai_data.model_dump_json()
            else:
                import json
                report_json = json.dumps(ai_data) if isinstance(ai_data, (dict, list)) else str(ai_data)
                
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {
                    "$set": {
                        "report_json": report_json,
                        "raw_reports": raw_data,
                        "status": "completed"
                    },
                    "$push": {"logs": "Audit complete. Vulnerability report generated."}
                }
            )
        except Exception as e:
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {
                    "$set": {
                        "status": "failed"
                    },
                    "$push": {"logs": f"CRITICAL ERROR: {str(e)}"}
                }
            )

    await perform_scan()

@router.post("/projects/{project_id}/scan", response_model=schema.ScanResponse)
async def run_automated_scan(
    project_id: str, 
    background_tasks: BackgroundTasks,
    payload: dict = None,
    current_user = Depends(get_current_user), 
    db = Depends(get_db)
):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scan_type = payload.get("type", "full") if payload else "full"
    
    scan_dict = {
        "project_id": project_id,
        "type": scan_type,
        "report_json": "{}", 
        "status": "pending",
        "logs": [f"Initializing {scan_type.upper()} security audit..."],
        "created_at": security.datetime.utcnow()
    }
    result = await db.scans.insert_one(scan_dict)
    scan_id = str(result.inserted_id)
    scan_dict["_id"] = result.inserted_id

    # Determine what to scan
    repo_url = project["repo_url"] if scan_type in ["full", "code"] else None
    deploy_url = project.get("deploy_url") if scan_type in ["full", "runtime"] else None

    # Decrypt token if exists
    gh_token = None
    gh_token_enc = current_user.get("github_token_encrypted")
    if gh_token_enc:
        try:
            gh_token = security.decrypt_token(gh_token_enc)
        except Exception:
            pass

    # Start the real scan in background
    background_tasks.add_task(run_scan_task, scan_id, project_id, repo_url, deploy_url, gh_token)

    return fix_id(scan_dict)

@router.get("/projects/{project_id}/scans", response_model=List[schema.ScanResponse])
async def get_project_scans(project_id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    cursor = db.scans.find({"project_id": project_id})
    scans = await cursor.to_list(length=100)
    return [fix_id(s) for s in scans]

@router.get("/scans/{scan_id}", response_model=schema.ScanResponse)
async def get_scan(scan_id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    scan = await db.scans.find_one({"_id": ObjectId(scan_id)})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    project = await db.projects.find_one({"_id": ObjectId(scan["project_id"]), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Scan not found or access denied")
        
    return fix_id(scan)

@router.post("/scans/{scan_id}/analyze")
async def analyze_issue(
    scan_id: str, 
    issue_index: int, 
    current_user = Depends(get_current_user), 
    db = Depends(get_db)
):
    scan = await db.scans.find_one({"_id": ObjectId(scan_id)})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    project = await db.projects.find_one({"_id": ObjectId(scan["project_id"]), "owner_id": str(current_user["_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        data = json.loads(scan["report_json"])
        issues = data.get("issues", [])
        if issue_index < 0 or issue_index >= len(issues):
            raise HTTPException(status_code=404, detail="Issue index out of bounds")
        issue = issues[issue_index]
    except Exception:
        raise HTTPException(status_code=500, detail="Corrupt report data")

    gh_token_enc = current_user.get("github_token_encrypted")
    if not gh_token_enc:
        return {"error": "No GitHub token connected."}
    
    gh_token = security.decrypt_token(gh_token_enc)
    
    # Extract file path from issue
    instances = issue.get("instances", [])
    if not instances:
        locs = issue.get("affected_locations", [])
        if locs:
            parts = locs[0].split(":")
            path = parts[0]
            line = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        else:
            return {"error": "No file location info available."}
    else:
        inst = instances[0]
        path = inst.get("path")
        line = inst.get("line")

    repo_url = project["repo_url"]
    
    full_content = GitHubService.get_file_content(gh_token, repo_url, path)
    if not full_content:
        return {"error": f"Failed to fetch content for {path}."}
        
    snippet = GitHubService.extract_snippet(full_content, line)
    
    user_prompt = generate_user_prompt(issue, snippet)
    analysis = llm_service.analyze_vulnerability(user_prompt)
    
    return {
        "issue_indices": issue_index,
        "file": path,
        "snippet": snippet,
        "ai_analysis": analysis
    }
