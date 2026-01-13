import sys
import os
# Add the parent directory (backend root) to sys.path to allow imports of sibling packages like 'jobs'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, projects
from .core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# CORS
origins = [
    "http://localhost",
    "http://localhost:3000", # React default
    "http://localhost:5173", # Vite default
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])

@app.get("/")
def read_root():
    return {"status": "ok", "msg": "Security SaaS API is running"}
