import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import UnicornLogo from "../imports/UnicornLogo";

export function CallToAction() {
  return (
    <section className="bg-gradient-to-br from-[#6D14EC] to-[#5a0fc7] py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-24 h-24 mx-auto mb-8">
          <UnicornLogo />
        </div>
        
        <h2 className="text-white mb-6" style={{ fontSize: '42px', fontWeight: 'bold' }}>
          아이만의 특별한 동화를 지금 만들어보세요
        </h2>
        
        <p className="text-white/90 mb-10 max-w-2xl mx-auto" style={{ fontSize: '18px' }}>
          AI 기술로 아이가 주인공이 되는 독특한 애니메이션 스토리를 경험해보세요
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            className="bg-[#F0D200] hover:bg-[#e0c200] text-[#6D14EC] rounded-full px-10 py-6 shadow-lg hover:shadow-xl transition-all"
            style={{ fontSize: '18px', fontWeight: '600' }}
          >
            무료로 시작하기
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          
          <Button 
            variant="outline"
            className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-[#6D14EC] rounded-full px-10 py-6 shadow-lg hover:shadow-xl transition-all"
            style={{ fontSize: '18px', fontWeight: '600' }}
          >
            샘플 보기
          </Button>
        </div>
      </div>
    </section>
  );
}
