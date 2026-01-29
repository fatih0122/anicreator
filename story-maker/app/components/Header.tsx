'use client';

import AnicreatorLogo from "../imports/AnicreatorLogo";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";
import { LogOut, User, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  onNavigate: (page: "home" | "login" | "create") => void;
  showStartOver?: boolean;
  onStartOver?: () => void;
}

export function Header({ onNavigate, showStartOver = false, onStartOver }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    onNavigate("home");
  };

  const handleProjectsClick = () => {
    router.push('/projects');
  };

  return (
    <header className="bg-white fixed top-0 left-0 right-0 z-20 shadow-sm">
      <div className="flex items-center justify-between h-[90px] px-6 px-[24px] py-[0px]">
        {/* Left section with logo */}
        <button
          onClick={() => onNavigate("home")}
          className="h-[70px] bg-white"
          style={{ width: 'auto' }}
        >
          <AnicreatorLogo className="h-[70px] w-auto" />
        </button>

        {/* Right section with buttons */}
        <div className="flex gap-3 items-center">
          {/* My Projects button */}
          <Button
            onClick={handleProjectsClick}
            variant="ghost"
            className="bg-white text-[#6D14EC] hover:bg-[#6D14EC] hover:text-white rounded-full px-6 py-2.5 shadow-sm hover:shadow-md transition-all border-2 border-white hover:border-[#6D14EC]"
            style={{ fontSize: '15px', fontWeight: '600' }}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            내 프로젝트
          </Button>

          {showStartOver && (
            <Button
              onClick={() => {
                if (onStartOver) {
                  onStartOver();
                }
              }}
              variant="ghost"
              className="bg-white text-[#6D14EC] hover:bg-[#6D14EC] hover:text-white rounded-full px-6 py-2.5 shadow-sm hover:shadow-md transition-all border-2 border-white hover:border-[#6D14EC]"
              style={{ fontSize: '15px', fontWeight: '600' }}
            >
              처음부터 시작
            </Button>
          )}

          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-sm border-2 border-white">
                <User className="w-4 h-4 text-[#6D14EC]" />
                <span className="text-sm font-medium text-[#6D14EC]">{user?.email}</span>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="bg-white text-[#6D14EC] hover:bg-[#6D14EC] hover:text-white rounded-full px-6 py-2.5 shadow-sm hover:shadow-md transition-all border-2 border-white hover:border-[#6D14EC]"
                style={{ fontSize: '15px', fontWeight: '600' }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => onNavigate("login")}
                variant="ghost"
                className="bg-white text-[#6D14EC] hover:bg-[#6D14EC] hover:text-white rounded-full px-6 py-2.5 shadow-sm hover:shadow-md transition-all border-2 border-white hover:border-[#6D14EC]"
                style={{ fontSize: '15px', fontWeight: '600' }}
              >
                로그인
              </Button>
              <Button
                className="bg-[#6D14EC] text-white hover:bg-[#5a0fc7] rounded-full px-6 py-2.5 shadow-md hover:shadow-lg transition-all"
                style={{ fontSize: '15px', fontWeight: '600' }}
              >
                회원가입
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
