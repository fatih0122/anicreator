#!/usr/bin/env python3
"""
Script to flush Redis and clear all job queues and worker registrations.
Run this to fix NotRegistered task errors.
"""

import redis
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Redis URL from environment
REDIS_URL = os.getenv('REDIS_URL')

if not REDIS_URL:
    print("❌ Error: REDIS_URL not found in environment variables")
    exit(1)

print(f"🔌 Connecting to Redis...")
print(f"   URL: {REDIS_URL[:20]}...")  # Show first 20 chars only for security

try:
    # Connect to Redis
    r = redis.from_url(REDIS_URL)

    # Test connection
    r.ping()
    print("✅ Connected to Redis successfully")

    # Get info before flush
    db_size = r.dbsize()
    print(f"📊 Current database size: {db_size} keys")

    # Flush all data
    print("\n🗑️  Flushing all Redis data...")
    r.flushall()

    # Verify flush
    new_db_size = r.dbsize()
    print(f"✅ Redis flushed successfully")
    print(f"📊 New database size: {new_db_size} keys")

    print("\n⚠️  Next steps:")
    print("   1. Restart the Railway backend service to reconnect Celery workers")
    print("   2. All workers will re-register their tasks with fresh definitions")
    print("   3. This should fix the NotRegistered errors")

except redis.ConnectionError as e:
    print(f"❌ Connection error: {e}")
    exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
