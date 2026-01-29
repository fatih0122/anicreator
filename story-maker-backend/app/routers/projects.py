from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.models.project import Project, Scene

router = APIRouter(prefix="/api/projects", tags=["projects"])


# Pydantic models for request/response
class SceneCreate(BaseModel):
    scene_number: int
    scene_type: Optional[str] = None
    script_text: Optional[str] = None
    image_prompt: Optional[str] = None
    video_prompt: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    narration_url: Optional[str] = None


class CharacterOption(BaseModel):
    id: int
    url: str
    prompt: str


class ProjectCreate(BaseModel):
    title: Optional[str] = None
    style: Optional[str] = None
    themes: Optional[List[str]] = None
    custom_theme: Optional[str] = None
    character_name: Optional[str] = None
    character_type: Optional[str] = None
    personality: Optional[str] = None
    character_description: Optional[str] = None
    character_image_url: Optional[str] = None
    character_creation_method: Optional[str] = None  # 'upload' or 'generate'
    character_options: Optional[List[CharacterOption]] = None
    character_prompt: Optional[str] = None
    selected_character_id: Optional[int] = None
    scene_count: Optional[int] = 6
    narration_voice: Optional[str] = None
    final_video_url: Optional[str] = None
    status: Optional[str] = "draft"
    current_step: Optional[str] = "style"


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    style: Optional[str] = None
    themes: Optional[List[str]] = None
    custom_theme: Optional[str] = None
    character_name: Optional[str] = None
    character_type: Optional[str] = None
    personality: Optional[str] = None
    character_description: Optional[str] = None
    character_image_url: Optional[str] = None
    character_creation_method: Optional[str] = None
    character_options: Optional[List[CharacterOption]] = None
    character_prompt: Optional[str] = None
    selected_character_id: Optional[int] = None
    scene_count: Optional[int] = None
    narration_voice: Optional[str] = None
    final_video_url: Optional[str] = None
    status: Optional[str] = None
    current_step: Optional[str] = None


class ScenesUpdate(BaseModel):
    scenes: List[SceneCreate]


@router.post("")
async def create_project(project: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Create a new project."""
    # Convert character_options to dict format for JSON storage
    char_options = None
    if project.character_options:
        char_options = [{"id": opt.id, "url": opt.url, "prompt": opt.prompt} for opt in project.character_options]

    db_project = Project(
        title=project.title,
        style=project.style,
        themes=project.themes,
        custom_theme=project.custom_theme,
        character_name=project.character_name,
        character_type=project.character_type,
        personality=project.personality,
        character_description=project.character_description,
        character_image_url=project.character_image_url,
        character_creation_method=project.character_creation_method,
        character_options=char_options,
        character_prompt=project.character_prompt,
        selected_character_id=project.selected_character_id,
        scene_count=project.scene_count,
        narration_voice=project.narration_voice,
        final_video_url=project.final_video_url,
        status=project.status,
        current_step=project.current_step,
    )
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)

    # Return simple dict without lazy-loaded scenes (new project has no scenes)
    return {
        "id": str(db_project.id),
        "status": "created",
        "project": {
            "id": str(db_project.id),
            "title": db_project.title,
            "style": db_project.style,
            "themes": db_project.themes,
            "custom_theme": db_project.custom_theme,
            "character_name": db_project.character_name,
            "character_type": db_project.character_type,
            "personality": db_project.personality,
            "character_description": db_project.character_description,
            "character_image_url": db_project.character_image_url,
            "character_creation_method": db_project.character_creation_method,
            "character_options": db_project.character_options,
            "character_prompt": db_project.character_prompt,
            "selected_character_id": db_project.selected_character_id,
            "scene_count": db_project.scene_count,
            "narration_voice": db_project.narration_voice,
            "final_video_url": db_project.final_video_url,
            "status": db_project.status,
            "current_step": db_project.current_step,
            "created_at": db_project.created_at.isoformat() if db_project.created_at else None,
            "updated_at": db_project.updated_at.isoformat() if db_project.updated_at else None,
            "scenes": [],
        }
    }


@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all projects, ordered by created_at descending."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.scenes))
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return {"projects": [p.to_dict() for p in projects]}


@router.get("/{project_id}")
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a single project with all its scenes."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.scenes))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": project.to_dict()}


@router.put("/{project_id}")
async def update_project(project_id: UUID, project_update: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    """Update a project."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.scenes))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)

    # Reload with scenes to avoid lazy loading issue
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.scenes))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    return {"id": str(project.id), "status": "updated", "project": project.to_dict()}


@router.delete("/{project_id}")
async def delete_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a project and all its scenes."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()
    return {"id": str(project_id), "status": "deleted"}


@router.post("/{project_id}/scenes")
async def save_scenes(project_id: UUID, scenes_data: ScenesUpdate, db: AsyncSession = Depends(get_db)):
    """Save/update scenes for a project. Replaces existing scenes."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete existing scenes
    await db.execute(delete(Scene).where(Scene.project_id == project_id))

    # Create new scenes
    for scene_data in scenes_data.scenes:
        scene = Scene(
            project_id=project_id,
            scene_number=scene_data.scene_number,
            scene_type=scene_data.scene_type,
            script_text=scene_data.script_text,
            image_prompt=scene_data.image_prompt,
            video_prompt=scene_data.video_prompt,
            image_url=scene_data.image_url,
            video_url=scene_data.video_url,
            narration_url=scene_data.narration_url,
        )
        db.add(scene)

    await db.commit()

    # Refresh project with scenes
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.scenes))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    return {"id": str(project_id), "status": "scenes_saved", "project": project.to_dict()}


@router.put("/{project_id}/scenes/{scene_number}")
async def update_scene(
    project_id: UUID,
    scene_number: int,
    scene_data: SceneCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a single scene by scene number."""
    result = await db.execute(
        select(Scene)
        .where(Scene.project_id == project_id)
        .where(Scene.scene_number == scene_number)
    )
    scene = result.scalar_one_or_none()

    if not scene:
        # Create new scene if it doesn't exist
        scene = Scene(
            project_id=project_id,
            scene_number=scene_number,
            scene_type=scene_data.scene_type,
            script_text=scene_data.script_text,
            image_prompt=scene_data.image_prompt,
            video_prompt=scene_data.video_prompt,
            image_url=scene_data.image_url,
            video_url=scene_data.video_url,
            narration_url=scene_data.narration_url,
        )
        db.add(scene)
    else:
        # Update existing scene
        update_data = scene_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(scene, key, value)

    await db.commit()
    await db.refresh(scene)
    return {"scene_number": scene_number, "status": "updated", "scene": scene.to_dict()}
