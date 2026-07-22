from app.api import profile
import uvicorn
from fastapi import FastAPI
from app.core.database import engine, Base
from app.models import models
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, arenas, activity, websocket, admin_arena  # Ensure admin_arena is imported here

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Tribely Backend - Social Accountability Micro-Arena Engine",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)

# Configure CORS for local IP testing, localhost, and production domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows local IP (192.168.1.125), localhost, and production frontends
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect modular HTTP and persistent WebSocket router stacks
app.include_router(auth.router)
app.include_router(arenas.router)
app.include_router(activity.router)
app.include_router(websocket.router)
app.include_router(admin_arena.router)
app.include_router(profile.router)

@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }

if __name__ == "__main__":
    # 0.0.0.0 binds FastAPI to all network interfaces (Localhost + Wi-Fi IP)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)