import os
from celery import Celery
from dotenv import load_dotenv

# Load environment variables from .env file (for local development)
load_dotenv()

# Get Redis URL from environment (Railway will provide this)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "story_maker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["celery_tasks"]  # Import tasks module
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max per task
    task_soft_time_limit=540,  # 9 minutes soft limit
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
)
