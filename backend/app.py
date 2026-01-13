from fastapi import FastAPI
from api import scan
import logging
import uvicorn


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)



app = FastAPI(title="Security Scanner Backend")

app.include_router(scan.router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Security Scanner"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
