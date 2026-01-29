'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { Project } from '@/app/services/api';
import { Plus, Trash2, Play, Calendar, Clock } from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getProjects();
      setProjects(response.projects);
    } catch (err) {
      setError('프로젝트를 불러오는데 실패했습니다.');
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return;

    try {
      setDeletingId(projectId);
      await api.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('프로젝트 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleProjectClick = (project: Project) => {
    router.push(`/projects/${project.id}`);
  };

  const handleNewProject = () => {
    router.push('/create/start');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            완료
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            진행중
          </span>
        );
    }
  };

  const getThumbnail = (project: Project) => {
    // First try character image, then first scene image
    if (project.character_image_url) {
      return project.character_image_url;
    }
    if (project.scenes && project.scenes.length > 0) {
      const firstSceneWithImage = project.scenes.find(s => s.image_url);
      if (firstSceneWithImage?.image_url) {
        return firstSceneWithImage.image_url;
      }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">내 프로젝트</h1>
              <p className="text-gray-500 mt-1">저장된 스토리 프로젝트를 확인하세요</p>
            </div>
            <button
              onClick={handleNewProject}
              className="flex items-center gap-2 px-5 py-3 bg-[#6D14EC] text-white rounded-full hover:bg-[#5a0fc7] transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">새 스토리</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#6D14EC] border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={loadProjects}
              className="px-4 py-2 bg-[#6D14EC] text-white rounded-lg hover:bg-[#5a0fc7]"
            >
              다시 시도
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              아직 프로젝트가 없습니다
            </h2>
            <p className="text-gray-500 mb-6">
              새로운 스토리를 만들어보세요!
            </p>
            <button
              onClick={handleNewProject}
              className="px-6 py-3 bg-[#6D14EC] text-white rounded-full hover:bg-[#5a0fc7] transition-all"
            >
              첫 스토리 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const thumbnail = getThumbnail(project);
              return (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group relative"
                >
                  {/* Delete Button - Shows on hover */}
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    disabled={deletingId === project.id}
                    className="absolute top-3 right-3 z-20 p-2 bg-white rounded-full hover:bg-red-50 transition-all shadow-md border border-gray-200 opacity-0 group-hover:opacity-100"
                  >
                    {deletingId === project.id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-500" />
                    )}
                  </button>

                  {/* Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 relative overflow-hidden">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.title || '프로젝트'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-12 h-12 text-purple-300" />
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 z-10">
                      {getStatusBadge(project.status)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">
                      {project.title || '제목 없음'}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {project.character_name && (
                        <span className="truncate">{project.character_name}</span>
                      )}
                      {project.style && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {project.style}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(project.created_at)}
                      </div>
                      {project.scene_count && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {project.scene_count} 씬
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
