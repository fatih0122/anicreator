import AnicreatorLogo from "../imports/AnicreatorLogo";
import { Button } from "./ui/button";
import { Upload, Sparkles, Image, Video, ArrowRight } from "lucide-react";

export function HeroSection() {
  const steps = [
    {
      icon: Upload,
      title: "스토리 아이디어 입력",
      description: "아이가 좋아하는 이야기 주제를 선택하고, 원하시면 아이의 사진을 업로드하세요."
    },
    {
      icon: Sparkles,
      title: "AI 캐릭터 생성",
      description: "AI가 업로드된 사진을 분석하여 아이의 모습으로 애니메이션 캐릭터를 생성합니다."
    },
    {
      icon: Image,
      title: "장면 이미지 생성",
      description: "스토리의 각 장면마다 AI가 생동감 있는 이미지를 자동으로 생성합니다."
    },
    {
      icon: Video,
      title: "비디오 제작 완료",
      description: "5초 분량의 장면들을 합치고 내레이션을 추가해 완성된 애니메이션을 만듭니다."
    }
  ];

  return (
    <section className="bg-gradient-to-br from-purple-50/50 via-white to-pink-50/30 py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-[#6D14EC] mb-4 flex items-center justify-center gap-2">
            <AnicreatorLogo className="h-8 w-auto inline-block" /> 사용 방법
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            간단한 4단계로 아이만의 특별한 애니메이션 동화를 만들어보세요
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="relative bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all group"
            >
              {/* Step Number */}
              <div className="absolute -top-3 -left-3 w-10 h-10 bg-[#F0D200] rounded-full flex items-center justify-center shadow-md">
                <span className="text-[#6D14EC]">{index + 1}</span>
              </div>

              {/* Icon */}
              <div className="mb-6 mt-2">
                <div className="w-14 h-14 bg-[#6D14EC] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <step.icon className="w-7 h-7 text-white" />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-[#6D14EC] mb-3">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button 
            className="bg-[#6D14EC] hover:bg-[#5a0fc7] text-white rounded-full px-52 py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            지금 시작하기
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
