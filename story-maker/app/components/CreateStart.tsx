'use client';

import { Button } from "./ui/button";
import UnicornLogo from "../imports/UnicornLogo";

interface CreateStartProps {
  onStart?: () => void;
}

export function CreateStart({ onStart }: CreateStartProps) {
  return (
    <div className="h-[calc(100vh-90px)] bg-white overflow-hidden flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white flex items-center justify-center px-6">
        <div className="w-full text-center">
          {/* Unicorn Logo */}
          <div className="flex justify-center mb-1">
            <UnicornLogo size={600} />
          </div>

          {/* Main Text */}
          <h1 className="text-gray-900 mb-2">
            나만의 이야기를 만들어볼까요?
          </h1>

          {/* Start Button */}
          <button
            onClick={onStart}
            className="bg-[#6D14EC] hover:bg-[#5a0fc7] text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer w-60 h-14 text-lg font-bold"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
