import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=True)
    style = Column(String(100), nullable=True)
    themes = Column(JSON, nullable=True)
    custom_theme = Column(Text, nullable=True)
    character_name = Column(String(100), nullable=True)
    character_type = Column(String(50), nullable=True)
    personality = Column(Text, nullable=True)
    character_description = Column(Text, nullable=True)
    character_image_url = Column(Text, nullable=True)
    character_creation_method = Column(String(20), nullable=True)  # 'upload' or 'generate'
    character_options = Column(JSON, nullable=True)  # [{id, url, prompt}]
    character_prompt = Column(Text, nullable=True)  # prompt used for character
    selected_character_id = Column(Integer, nullable=True)  # which option was selected
    scene_count = Column(Integer, default=6)
    narration_voice = Column(String(100), nullable=True)
    final_video_url = Column(Text, nullable=True)
    status = Column(String(20), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "style": self.style,
            "themes": self.themes,
            "custom_theme": self.custom_theme,
            "character_name": self.character_name,
            "character_type": self.character_type,
            "personality": self.personality,
            "character_description": self.character_description,
            "character_image_url": self.character_image_url,
            "character_creation_method": self.character_creation_method,
            "character_options": self.character_options,
            "character_prompt": self.character_prompt,
            "selected_character_id": self.selected_character_id,
            "scene_count": self.scene_count,
            "narration_voice": self.narration_voice,
            "final_video_url": self.final_video_url,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "scenes": [scene.to_dict() for scene in self.scenes] if self.scenes else [],
        }


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    scene_number = Column(Integer, nullable=False)
    scene_type = Column(String(50), nullable=True)
    script_text = Column(Text, nullable=True)
    image_prompt = Column(Text, nullable=True)
    video_prompt = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    video_url = Column(Text, nullable=True)
    narration_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="scenes")

    def to_dict(self):
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "scene_number": self.scene_number,
            "scene_type": self.scene_type,
            "script_text": self.script_text,
            "image_prompt": self.image_prompt,
            "video_prompt": self.video_prompt,
            "image_url": self.image_url,
            "video_url": self.video_url,
            "narration_url": self.narration_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
