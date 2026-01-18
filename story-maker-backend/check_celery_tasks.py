#!/usr/bin/env python3
"""
Script to check which Celery tasks are registered and available.
This helps diagnose NotRegistered errors.
"""

import os
from dotenv import load_dotenv
from celery_config import celery_app

# Load environment variables
load_dotenv()

print("=" * 80)
print("CELERY TASK REGISTRATION CHECK")
print("=" * 80)

# Import the tasks module to trigger registration
print("\n📦 Importing celery_tasks module...")
try:
    import celery_tasks
    print("✅ celery_tasks module imported successfully")
except Exception as e:
    print(f"❌ Error importing celery_tasks: {e}")
    exit(1)

# Get all registered tasks
print("\n📋 Registered tasks:")
print("-" * 80)

registered_tasks = sorted(celery_app.tasks.keys())

# Filter out built-in Celery tasks
user_tasks = [task for task in registered_tasks if not task.startswith('celery.')]

if user_tasks:
    for i, task_name in enumerate(user_tasks, 1):
        print(f"{i}. {task_name}")
else:
    print("⚠️  No user tasks found!")

print(f"\nTotal user tasks: {len(user_tasks)}")

# Check for the specific tasks we care about
print("\n🔍 Checking for required tasks:")
print("-" * 80)

required_tasks = [
    "tasks.generate_story_script",
    "tasks.generate_image_prompts",
    "tasks.generate_video_prompts",
    "tasks.generate_side_character_images",
    "tasks.generate_scene_images",
    "tasks.generate_narrations",
    "tasks.generate_videos",
    "tasks.generate_final_video"
]

for task_name in required_tasks:
    if task_name in celery_app.tasks:
        print(f"✅ {task_name}")
    else:
        print(f"❌ {task_name} - NOT REGISTERED")

print("\n" + "=" * 80)

# Also check the Celery config
print("\n⚙️  Celery Configuration:")
print("-" * 80)
print(f"Broker: {celery_app.conf.broker_url[:30]}...")
print(f"Backend: {celery_app.conf.result_backend[:30]}...")
print(f"Include: {celery_app.conf.include}")
print(f"Task serializer: {celery_app.conf.task_serializer}")
print(f"Worker prefetch multiplier: {celery_app.conf.worker_prefetch_multiplier}")

print("\n" + "=" * 80)
