"""
Migration script to add new character-related columns to the projects table.

Run this script once to add the missing columns:
  python -m migrations.add_character_fields

New columns:
  - character_creation_step: VARCHAR(20) DEFAULT 'method'
  - is_character_uploaded: BOOLEAN DEFAULT FALSE
  - uploaded_character_url: TEXT NULL
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate():
    """Add new columns to the projects table."""
    engine = create_async_engine(DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        # Check if columns already exist before adding them

        # Add character_creation_step column
        try:
            await conn.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS character_creation_step VARCHAR(20) DEFAULT 'method'
            """))
            print("✅ Added character_creation_step column")
        except Exception as e:
            print(f"⚠️ character_creation_step column may already exist: {e}")

        # Add is_character_uploaded column
        try:
            await conn.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS is_character_uploaded BOOLEAN DEFAULT FALSE
            """))
            print("✅ Added is_character_uploaded column")
        except Exception as e:
            print(f"⚠️ is_character_uploaded column may already exist: {e}")

        # Add uploaded_character_url column
        try:
            await conn.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS uploaded_character_url TEXT NULL
            """))
            print("✅ Added uploaded_character_url column")
        except Exception as e:
            print(f"⚠️ uploaded_character_url column may already exist: {e}")

    await engine.dispose()
    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
