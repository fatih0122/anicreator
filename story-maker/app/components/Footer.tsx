import BeeLogo from "../imports/BeeLogo-2-51";
import { Mail, Instagram, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Description */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10">
                <BeeLogo />
              </div>
              <span className="text-[#F0D200]" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                Anicreator
              </span>
            </div>
            <p className="text-gray-400 max-w-md" style={{ fontSize: '14px' }}>
              AI 기술로 아이들에게 특별한 경험을 선사하는 애니메이션 스토리 플랫폼입니다.
            </p>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="mb-4" style={{ fontSize: '16px', fontWeight: 'bold' }}>
              바로가기
            </h3>
            <ul className="space-y-2 text-gray-400" style={{ fontSize: '14px' }}>
              <li><a href="#" className="hover:text-[#F0D200] transition-colors">작품 둘러보기</a></li>
              <li><a href="#" className="hover:text-[#F0D200] transition-colors">사용 방법</a></li>
              <li><a href="#" className="hover:text-[#F0D200] transition-colors">요금제</a></li>
              <li><a href="#" className="hover:text-[#F0D200] transition-colors">자주 묻는 질문</a></li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="mb-4" style={{ fontSize: '16px', fontWeight: 'bold' }}>
              문의하기
            </h3>
            <ul className="space-y-2 text-gray-400" style={{ fontSize: '14px' }}>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:hello@anicreator.com" className="hover:text-[#F0D200] transition-colors">
                  hello@anicreator.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                <a href="#" className="hover:text-[#F0D200] transition-colors">
                  @anicreator_official
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Youtube className="w-4 h-4" />
                <a href="#" className="hover:text-[#F0D200] transition-colors">
                  Anicreator Channel
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 text-center text-gray-400" style={{ fontSize: '14px' }}>
          <p>© 2025 Anicreator. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
