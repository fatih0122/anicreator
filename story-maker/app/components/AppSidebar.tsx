'use client';

import { Home, Sparkles, Image, Settings, HelpCircle, Mic, Video } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const menuItems = [
  { id: "home", label: "홈", icon: Home },
  { id: "create", label: "만들기", icon: Sparkles },
  { id: "gallery", label: "캐릭터", icon: Image },
  { id: "voices", label: "보이스", icon: Mic },
  { id: "my-generation", label: "클립", icon: Video },
  { id: "settings", label: "설정", icon: Settings },
  { id: "help", label: "도움말", icon: HelpCircle },
];

interface AppSidebarProps {
  onNavigate?: (page: "home" | "login" | "create") => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const [activeItem, setActiveItem] = useState("home");

  // Update active item based on current path
  useEffect(() => {
    if (pathname.startsWith('/create')) {
      setActiveItem('create');
    } else if (pathname === '/') {
      setActiveItem('home');
    }
  }, [pathname]);

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    if (onNavigate) {
      if (itemId === "home") {
        onNavigate("home");
      } else if (itemId === "create") {
        onNavigate("create");
      }
    }
  };

  return (
    <div className="w-60 border-r bg-white fixed left-0 top-[90px] bottom-0 z-10 flex flex-col">
      <div className="px-3 pt-6 pb-6 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 h-full">
          <div className="flex flex-col gap-2">
            {menuItems.slice(0, -1).map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`flex items-center gap-3 h-12 px-5 rounded-full transition-all ${
                  activeItem === item.id
                    ? 'bg-[#6D14EC] text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span style={{ fontSize: '16px' }}>{item.label}</span>
              </button>
            ))}
          </div>
          
          <div className="flex-1"></div>
          
          <button
            onClick={() => handleItemClick("help")}
            className={`flex items-center gap-3 h-12 px-5 rounded-full transition-all ${
              activeItem === "help"
                ? 'bg-[#6D14EC] text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span style={{ fontSize: '16px' }}>도움말</span>
          </button>
        </div>
      </div>
    </div>
  );
}
