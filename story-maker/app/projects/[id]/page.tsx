'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStory } from '@/app/context/StoryContext';
import api, { Project } from '@/app/services/api';

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const story = useStory();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      const projectId = params.id as string;
      if (!projectId) {
        setError('프로젝트 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        const response = await api.getProject(projectId);
        const project = response.project;

        // Load project into context
        story.loadFromProject(project);

        // Step-to-page mapping
        const stepToPage: Record<string, string> = {
          'style': '/create/style',
          'category': '/create/category',
          'character': '/create/character',
          'scene': '/create/scene',
          'final': '/create/final',
        };

        // Use current_step if available, otherwise fallback to inferring from project state
        let targetPage = '/create/style';

        if (project.current_step && stepToPage[project.current_step]) {
          // Use explicit current_step from database
          targetPage = stepToPage[project.current_step];
        } else {
          // Fallback: infer step from project state (backward compatibility)
          if (project.final_video_url) {
            targetPage = '/create/final';
          } else if (project.scenes && project.scenes.some(s => s.video_url)) {
            targetPage = '/create/scene';
          } else if (project.scenes && project.scenes.some(s => s.image_url)) {
            targetPage = '/create/scene';
          } else if (project.scenes && project.scenes.length > 0) {
            targetPage = '/create/scene';
          } else if (project.character_image_url) {
            targetPage = '/create/scene';
          } else if (project.character_name) {
            targetPage = '/create/character';
          } else if (project.narration_voice || project.scene_count) {
            targetPage = '/create/character';
          } else if (project.style) {
            targetPage = '/create/category';
          }
        }

        // Navigate to appropriate page
        router.push(targetPage);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('프로젝트를 불러오는데 실패했습니다.');
        setLoading(false);
      }
    };

    loadProject();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#6D14EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/projects')}
            className="px-4 py-2 bg-[#6D14EC] text-white rounded-lg hover:bg-[#5a0fc7]"
          >
            프로젝트 목록으로
          </button>
        </div>
      </div>
    );
  }

  return null;
}
