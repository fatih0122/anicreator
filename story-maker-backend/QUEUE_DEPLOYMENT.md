# Background Job Queue Deployment Guide

This guide explains how to deploy the Story Maker backend with the new background job queue system on Railway.

## What Changed?

We've implemented a **background job queue** using **Celery + Redis** to handle long-running tasks asynchronously. This allows the backend to handle 40+ concurrent users without timeouts.

### Endpoints Converted to Background Jobs:

**Text & Script Generation:**
1. **`POST /api/story/generate-script`** - Story script generation (2-3 minutes)

**Image Generation:**
2. **`POST /api/character/generate`** - Character image generation (10-20 seconds for 2 images)
3. **`POST /api/character/generate-from-upload`** - Character variation from upload (15-25 seconds)
4. **`POST /api/scenes/generate-images`** - Scene image generation (30-60 seconds for 5 scenes)
5. **`POST /api/side-characters/generate-images`** - Side character generation (20-40 seconds)

**Video Generation:**
6. **`POST /api/videos/generate`** - Video generation (2-3 minutes per scene)
7. **`POST /api/video/generate-final`** - Final video combining (1-2 minutes)

### How It Works:

**Before (Synchronous):**
```
User Request → Wait 2-3 minutes → Response
```
- Problem: Worker blocked, other users get timeouts

**After (Asynchronous with Queue):**
```
User Request → Job ID returned immediately → User polls for status → Result when done
```
- Benefit: Handle 100+ queued jobs with just 4 workers

## Deployment Steps on Railway

### 1. Add Redis to Your Railway Project

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add Redis"**
3. Railway will automatically create a Redis instance and set the `REDIS_URL` environment variable

### 2. Verify Environment Variables

Your backend service should have these environment variables:
- `REDIS_URL` - Automatically set by Railway when you add Redis
- `PORT` - Automatically set by Railway
- `ALLOWED_ORIGINS` - Your frontend URL (e.g., `https://stobee-v1.vercel.app`)
- All other existing env vars (API keys, S3 credentials, etc.)

### 3. Deploy the Backend

The updated code includes:
- ✅ `requirements.txt` - Added `celery[redis]` and `redis`
- ✅ `celery_config.py` - Celery configuration
- ✅ `celery_tasks.py` - Background task definitions
- ✅ `start.sh` - Starts both Celery worker and FastAPI
- ✅ `main.py` - Updated endpoints to use jobs

Push your changes to trigger a Railway deployment:

```bash
cd /Users/fatihwolf/Documents/story-maker-backend
git add .
git commit -m "Add background job queue with Celery + Redis"
git push
```

Railway will automatically:
1. Install dependencies (including Celery and Redis)
2. Run `start.sh` which:
   - Installs ffmpeg
   - Starts Celery worker (2 concurrent tasks)
   - Starts FastAPI server (4 workers)

### 4. Verify Deployment

After deployment, check the logs in Railway:

**You should see:**
```
Installing ffmpeg...
Starting Celery worker...
celery@hostname ready.
Starting FastAPI application...
```

**Test the deployment:**
```bash
curl https://your-backend.railway.app/health
# Should return: {"status":"healthy"}
```

## Architecture Overview

```
┌─────────────┐
│  Frontend   │
│  (Next.js)  │
└──────┬──────┘
       │ 1. POST /api/videos/generate
       ▼
┌─────────────────┐
│   FastAPI       │
│   (4 workers)   │ 2. Returns job_id immediately
└────────┬────────┘
         │ 3. Adds job to Redis queue
         ▼
    ┌────────┐
    │  Redis │ ◄──────┐
    └────┬───┘        │
         │            │ 5. Polls for status
         │ 4. Celery │
         │    worker  │
         │   processes│
         ▼            │
┌──────────────┐     │
│ Celery Worker│     │
│ (2 concurrent)├─────┘
└──────────────┘
         │
         │ 6. Result stored in Redis
         ▼
   Frontend gets result
```

## Performance Improvements

### Before (Synchronous):
- **Concurrent users**: ~4-8
- **Timeout issues**: Frequent (30-60 second limits)
- **User experience**: Blocking, no progress updates

### After (Async with Queue):
- **Concurrent users**: 40+
- **Timeout issues**: None (immediate job ID response)
- **User experience**: Progress updates, no blocking

### Resource Usage:
- **FastAPI Workers**: 4 (handles HTTP requests)
- **Celery Workers**: 2 (processes background jobs)
- **Memory**: ~2GB recommended for smooth operation
- **Redis**: Minimal (~50MB for job queue)

## Monitoring Jobs

### Check Job Status (API):
```bash
# Get job status
curl https://your-backend.railway.app/api/job/{job_id}

# Response:
{
  "job_id": "abc123",
  "state": "PROGRESS",
  "status": "Generating video 2/5...",
  "progress": {
    "current": 2,
    "total": 5
  }
}
```

### Check Celery Worker Health (Railway Logs):
```
[2025-10-24 10:30:00] celery@worker ready.
[2025-10-24 10:31:00] Task tasks.generate_videos[abc123] received
[2025-10-24 10:33:00] Task tasks.generate_videos[abc123] succeeded
```

## Troubleshooting

### Issue: "Connection refused" errors in logs
**Solution**: Make sure Redis is added to your Railway project and `REDIS_URL` is set.

### Issue: Jobs stuck in "PENDING" state
**Solution**: Check that Celery worker is running in Railway logs. Look for "celery@hostname ready".

### Issue: "Task not found" errors
**Solution**: Make sure `celery_tasks.py` is included in your deployment and imports are correct.

### Issue: High memory usage
**Solution**:
- Reduce `--concurrency=2` to `--concurrency=1` in `start.sh`
- Reduce Gunicorn workers from 4 to 2
- Upgrade Railway plan for more memory

## Scaling Further (For 100+ Users)

If you need to scale beyond 40 users:

1. **Separate Services**: Split FastAPI and Celery into separate Railway services
   - FastAPI service: Scale to 6-8 workers
   - Celery service: Scale to 4-6 workers

2. **Add Celery Beat** (for scheduled tasks):
   ```bash
   celery -A celery_config.celery_app beat
   ```

3. **Monitor with Flower** (Celery monitoring tool):
   ```bash
   celery -A celery_config.celery_app flower
   ```

4. **Use Redis Sentinel** (for Redis high availability)

5. **Add Rate Limiting** (per user):
   ```python
   # In main.py
   from slowapi import Limiter
   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   ```

## Frontend Changes

The frontend automatically handles the new job-based API. No code changes needed in components!

The `api.ts` service now:
- ✅ Starts jobs automatically
- ✅ Polls for completion every 2 seconds
- ✅ Calls progress callbacks if provided
- ✅ Returns final result when complete

**Example (optional progress tracking):**
```typescript
const result = await api.generateStoryScript(
  characterName,
  characterType,
  characterPrompt,
  personality,
  themes,
  customTheme,
  numScenes,
  style,
  (progress) => {
    console.log(`${progress.status}: ${progress.current}/${progress.total}`);
    // Update UI with progress
  }
);
```

## Summary

✅ **Added**: Celery + Redis for background job processing
✅ **Benefit**: Handle 40+ concurrent users without timeouts
✅ **Deployment**: Add Redis on Railway, push code
✅ **Frontend**: Automatically handles job polling
✅ **Monitoring**: Check logs for Celery worker status

Your backend can now handle production traffic with ease! 🚀
