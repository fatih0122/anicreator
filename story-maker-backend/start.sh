#!/bin/bash
set -e

# Kill any existing Celery workers to ensure clean start
echo "Cleaning up any existing Celery workers..."
pkill -9 -f "celery.*worker" || true

# Install ffmpeg if not present
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    apt-get update && apt-get install -y ffmpeg
fi

# Start Celery worker in the background with --pool=solo for better process control
echo "Starting Celery worker..."
# Suppress root user warning in containerized environments
export C_FORCE_ROOT=true
# Use --pool=solo to run tasks in the main worker process (prevents zombie processes)
# Use --max-tasks-per-child=50 to restart worker after 50 tasks (prevents memory leaks)
celery -A celery_config.celery_app worker \
    --loglevel=info \
    --concurrency=2 \
    --max-tasks-per-child=50 \
    --pool=prefork &

# Store the Celery PID
CELERY_PID=$!

# Wait a moment for Celery to start
sleep 3

# Trap to ensure Celery worker is killed when script exits
trap "echo 'Shutting down Celery worker...'; kill -TERM $CELERY_PID 2>/dev/null || true; wait $CELERY_PID 2>/dev/null || true" EXIT TERM INT

# Start the FastAPI application (this blocks, so it should be last)
echo "Starting FastAPI application..."
exec gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --graceful-timeout 300
