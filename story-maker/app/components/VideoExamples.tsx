import { useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Star, Compass, Wand2, GraduationCap, Users } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface VideoExample {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  size: 'large' | 'medium' | 'small';
}

function NavButton({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 rounded-full transition-all duration-300 min-w-[90px] ${
        active 
          ? 'bg-[#6D14EC] border border-[#6D14EC]' 
          : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="text-white">
        {icon}
      </div>
      <span className="text-[10px] font-medium text-white whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

const videoExamples: VideoExample[] = [
  // 추천신작 (Recommended New)
  { 
    id: "1", 
    title: "하얀 강아지", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1716158690322-1057dc2c7267?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMHB1cHB5JTIwZG9nfGVufDF8fHx8MTc2MDk1NjE0Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "2", 
    title: "야외의 아이", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1667278153221-26b4da0287c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGNoaWxkJTIwcG9ydHJhaXQlMjBvdXRkb29yfGVufDF8fHx8MTc2MDk1NjE0Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "3", 
    title: "행복한 미소", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1621926289600-c12c7720c723?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGNoaWxkJTIwc21pbGluZ3xlbnwxfHx8fDE3NjA5NTYxNDN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "4", 
    title: "무지개 드레스", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1578461267365-2712a3ce8b46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGNvbG9yZnVsJTIwZHJlc3N8ZW58MXx8fHwxNzYwOTU2MTQzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "5", 
    title: "가족 순간", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1758513423681-662999098875?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBtb21lbnQlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjA5NTYxNDN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // 인기 (Popular)
  { 
    id: "6", 
    title: "고양이 친구", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1609854892250-72dab0fc9282?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraXR0ZW4lMjBjdXRlfGVufDF8fHx8MTc2MDk1NjE0NHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "7", 
    title: "놀이터에서", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1637195789142-27f844c316ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHBsYXlpbmclMjBvdXRkb29yfGVufDF8fHx8MTc2MDk1NjE0NHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "8", 
    title: "바닷가 풍경", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1600768828452-df963df86406?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGJlYWNoJTIwbGFuZHNjYXBlfGVufDF8fHx8MTc2MDk1NjE0NHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "9", 
    title: "자연 속", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1707043471062-09a0415927e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMG5hdHVyZSUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NjA5NTYxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "10", 
    title: "나비와 함께", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1576299131105-7fe20caed6a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXR0ZXJmbHklMjBjb2xvcmZ1bHxlbnwxfHx8fDE3NjA5NTYxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // 모험 (Adventure)
  { 
    id: "11", 
    title: "모험가", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1541520380050-3499080c379e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGFkdmVudHVyZSUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MDk1NjE0NXww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "12", 
    title: "겨울 이야기", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1670088900371-33b85fce2407?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHdpbnRlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MDk1NjE0Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "13", 
    title: "토끼 친구", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1659324798203-43b29bd7c5f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidW5ueSUyMHJhYmJpdCUyMGN1dGV8ZW58MXx8fHwxNzYwODcyNDg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "14", 
    title: "꽃밭에서", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1619947388335-a0bf4b910471?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGdhcmRlbiUyMGZsb3dlcnN8ZW58MXx8fHwxNzYwOTU2MTQ2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "15", 
    title: "독서 시간", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1565843248736-8c41e6db117b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHJlYWRpbmclMjBib29rfGVufDF8fHx8MTc2MDk1NjE0N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // 판타지 (Fantasy)
  { 
    id: "16", 
    title: "석양 풍경", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1630022251361-40d5b1a971f2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW5zZXQlMjBsYW5kc2NhcGUlMjBjaGlsZHxlbnwxfHx8fDE3NjA5NTYxNDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "17", 
    title: "그림 그리기", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1666710988451-ba4450498967?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHBhaW50aW5nJTIwYXJ0fGVufDF8fHx8MTc2MDk1NjE0N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "18", 
    title: "풍선 날리기", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1728580180788-f2c6bcb926b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGJhbGxvb24lMjBoYXBweXxlbnwxfHx8fDE3NjA5NTYxNDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "19", 
    title: "숲 속 탐험", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1621293044691-593d527b3c0d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGZvcmVzdCUyMG5hdHVyZXxlbnwxfHx8fDE3NjA5NTYxNDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "20", 
    title: "아기 오리", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1660011052791-e1afdb433cb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdWNrbGluZyUyMGJhYnklMjBhbmltYWx8ZW58MXx8fHwxNzYwOTU2MTQ5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // Additional videos - 추천신작
  { 
    id: "21", 
    title: "친구들과 놀이", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1628435509114-969a718d64e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGNoaWxkcmVuJTIwcGxheWluZ3xlbnwxfHx8fDE3NjA4MzE4NDR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "22", 
    title: "갈색 강아지", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1649003592839-ce0bf1a804fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwcHVwcHklMjBkb2d8ZW58MXx8fHwxNzYwODY3NDYxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "23", 
    title: "환한 미소", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1750508720320-efd342adf07f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHBvcnRyYWl0JTIwY29sb3JmdWx8ZW58MXx8fHwxNzYwOTU2NTYxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "24", 
    title: "햄스터 친구", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1630412989932-7d422f8ac136?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwaGFtc3RlciUyMHBldHxlbnwxfHx8fDE3NjA4Nzg4Mjd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "25", 
    title: "들판에서", 
    category: "추천신작", 
    imageUrl: "https://images.unsplash.com/photo-1561005645-f384591197ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMG91dGRvb3IlMjBuYXR1cmV8ZW58MXx8fHwxNzYwOTU2NTYyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // Additional videos - 인기
  { 
    id: "26", 
    title: "여우 이야기", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1711890597036-08999ad09389?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwZm94JTIwYW5pbWFsfGVufDF8fHx8MTc2MDk1NjU2Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "27", 
    title: "동화 속 공주", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1616117050338-3deee63be63d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGZhaXJ5JTIwdGFsZSUyMGNvc3R1bWV8ZW58MXx8fHwxNzYwOTU2NTYyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "28", 
    title: "마법의 숲", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1611627125959-712f6a5feef0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWdpY2FsJTIwZm9yZXN0JTIwbGFuZHNjYXBlfGVufDF8fHx8MTc2MDk1NjU2M3ww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "29", 
    title: "부엉이 친구", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1707157188951-65b45cbfa6d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwb3dsJTIwYmlyZHxlbnwxfHx8fDE3NjA4NTcyNjV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "30", 
    title: "장난감 시간", 
    category: "인기", 
    imageUrl: "https://images.unsplash.com/photo-1552139684-9393e55cb7d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHBsYXlpbmclMjB0b3lzfGVufDF8fHx8MTc2MDk1MTk4OHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // Additional videos - 모험
  { 
    id: "31", 
    title: "펭귄 탐험", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1717507717678-fe8ec2485c02?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwcGVuZ3VpbiUyMGFuaW1hbHxlbnwxfHx8fDE3NjA5NTY1NjR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "32", 
    title: "산 속 여행", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1708339624704-38e0f7aa8227?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGhpa2luZyUyMGFkdmVudHVyZXxlbnwxfHx8fDE3NjA5NTY1NjR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "33", 
    title: "석양 속으로", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1643559247329-7254c71646f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGxhbmRzY2FwZSUyMHN1bnNldHxlbnwxfHx8fDE3NjA4NTQ1Mzh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "34", 
    title: "고슴도치 친구", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1560951022-00b231707a12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwaGVkZ2Vob2clMjBhbmltYWx8ZW58MXx8fHwxNzYwOTU2NTY1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "35", 
    title: "상상의 세계", 
    category: "모험", 
    imageUrl: "https://images.unsplash.com/photo-1760464600453-2aa3b68fd9fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGltYWdpbmF0aW9uJTIwY3JlYXRpdmV8ZW58MXx8fHwxNzYwODkzNTA1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // Additional videos - 판타지
  { 
    id: "36", 
    title: "무지개 하늘", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1631325067302-5b25e5d442b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyYWluYm93JTIwc2t5JTIwbGFuZHNjYXBlfGVufDF8fHx8MTc2MDk1NjU2Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "37", 
    title: "다람쥐 놀이", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1719174724922-779e017efcd6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwc3F1aXJyZWwlMjBhbmltYWx8ZW58MXx8fHwxNzYwOTU2NTY2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "38", 
    title: "마법 이야기", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1584094053761-d61ebfc149b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMG1hZ2ljJTIwZmFudGFzeXxlbnwxfHx8fDE3NjA5NTY1NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "39", 
    title: "사슴 친구", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1746381979741-2711cf1236de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwZGVlciUyMGZhd258ZW58MXx8fHwxNzYwOTQzNDU5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "40", 
    title: "별빛 꿈", 
    category: "판타지", 
    imageUrl: "https://images.unsplash.com/photo-1708013718509-48eb15b4faad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGRyZWFtaW5nJTIwc3RhcnN8ZW58MXx8fHwxNzYwOTU2NTY3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // 교육 (Education)
  { 
    id: "41", 
    title: "숫자 배우기", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGxlYXJuaW5nJTIwbnVtYmVyc3xlbnwxfHx8fDE3NjA5NTY1Njd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "42", 
    title: "알파벳 시간", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGxlYXJuaW5nJTIwYWxwaGFiZXR8ZW58MXx8fHwxNzYwOTU2NTY4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "43", 
    title: "과학 실험", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1516375631220-0e3c8cc8821f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHNjaWVuY2UlMjBleHBlcmltZW50fGVufDF8fHx8MTc2MDk1NjU2OHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "44", 
    title: "색깔 찾기", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1565032923396-fcdcf6b1e3c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGNvbG9ycyUyMGxlYXJuaW5nfGVufDF8fHx8MTc2MDk1NjU2OXww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "45", 
    title: "우주 탐험", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFjZSUyMHN0YXJzJTIwZ2FsYXh5fGVufDF8fHx8MTc2MDk1NjU2OXww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "46", 
    title: "음악 수업", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMG11c2ljJTIwbGVhcm5pbmd8ZW58MXx8fHwxNzYwOTU2NTY5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "47", 
    title: "지구 이야기", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1569163139394-de4798aa62b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlYXJ0aCUyMGdsb2JlJTIwcGxhbmV0fGVufDF8fHx8MTc2MDk1NjU3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "48", 
    title: "모양 배우기", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1611197118018-8fbdfd0b2b4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMGxlYXJuaW5nJTIwc2hhcGVzfGVufDF8fHx8MTc2MDk1NjU3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "49", 
    title: "날씨 공부", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWF0aGVyJTIwY2xvdWRzJTIwc2t5fGVufDF8fHx8MTc2MDk1NjU3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "50", 
    title: "동물 세계", 
    category: "교육", 
    imageUrl: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltYWxzJTIwd2lsZGxpZmUlMjBuYXR1cmV8ZW58MXx8fHwxNzYwOTU2NTcxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  
  // 가족 (Family)
  { 
    id: "51", 
    title: "가족 여행", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1476703993599-0035a21b17a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjB0cmF2ZWwlMjB0b2dldGhlcnxlbnwxfHx8fDE3NjA5NTY1NzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "52", 
    title: "엄마와 아이", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1609220136736-443140cffec6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3RoZXIlMjBjaGlsZCUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MDk1NjU3MXww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "53", 
    title: "아빠와 놀이", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1609840113972-89ecdb47ab50?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXRoZXIlMjBjaGlsZCUyMHBsYXlpbmd8ZW58MXx8fHwxNzYwOTU2NTcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "54", 
    title: "할머니 이야기", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFuZG1vdGhlciUyMGNoaWxkJTIwdG9nZXRoZXJ8ZW58MXx8fHwxNzYwOTU2NTcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "55", 
    title: "형제자매", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1655214021970-3dc3ed2f7a23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWJsaW5ncyUyMGNoaWxkcmVuJTIwdG9nZXRoZXJ8ZW58MXx8fHwxNzYwOTU2NTcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "56", 
    title: "가족 저녁", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1608096299210-db7e38487075?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBkaW5uZXIlMjB0b2dldGhlcnxlbnwxfHx8fDE3NjA5NTY1NzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'large'
  },
  { 
    id: "57", 
    title: "공원 나들이", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBwYXJrJTIwb3V0ZG9vcnxlbnwxfHx8fDE3NjA5NTY1NzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "58", 
    title: "할아버지와 함께", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFuZGZhdGhlciUyMGNoaWxkJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzYwOTU2NTczfDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'medium'
  },
  { 
    id: "59", 
    title: "생일 파티", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaXJ0aGRheSUyMHBhcnR5JTIwY2VsZWJyYXRpb258ZW58MXx8fHwxNzYwOTU2NTc0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
  { 
    id: "60", 
    title: "가족 사진", 
    category: "가족", 
    imageUrl: "https://images.unsplash.com/photo-1511895426328-dc8714191300?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBwb3J0cmFpdCUyMHRvZ2V0aGVyfGVufDF8fHx8MTc2MDk1NjU3NHww&ixlib=rb-4.1.0&q=80&w=1080",
    size: 'small'
  },
];

export function VideoExamples() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [scrollPosition, setScrollPosition] = useState(0);

  const categories = [
    { id: "전체", label: "전체", icon: LayoutGrid },
    { id: "인기", label: "인기", icon: Star },
    { id: "모험", label: "모험", icon: Compass },
    { id: "판타지", label: "판타지", icon: Wand2 },
    { id: "교육", label: "교육", icon: GraduationCap },
    { id: "가족", label: "가족", icon: Users },
  ];

  const filteredVideos = selectedCategory === "전체" 
    ? videoExamples 
    : videoExamples.filter(v => v.category === selectedCategory);
  
  // Group videos into pages of 10 (two rows of masonry layout)
  const videosPerPage = 10;
  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const currentPageVideos = filteredVideos.slice(
    scrollPosition * videosPerPage, 
    (scrollPosition + 1) * videosPerPage
  );

  const handlePrev = () => {
    setScrollPosition(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setScrollPosition(prev => Math.min(totalPages - 1, prev + 1));
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setScrollPosition(0); // Reset scroll when changing category
  };

  return (
    <section className="pt-4 pb-16 px-8 bg-white">
      <div className="w-full">
        {/* Title */}
        <div className="mb-12 relative overflow-visible rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 to-black/90 rounded-3xl"></div>
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1758749917314-402d7fe1f8b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWFnaWNhbCUyMHN0b3J5dGVsbGluZyUyMGJhY2tncm91bmR8ZW58MXx8fHwxNzYwOTU3MjI5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover opacity-30 rounded-3xl"
          />
          <div className="relative py-8 px-8 text-center pb-10 pt-12">
            <h2 className="text-5xl mb-3" style={{ fontWeight: 'bold', color: 'white' }}>
              <span style={{ color: '#F0D200' }}>Anicreator AI.</span> 당신의 새로운 스토리 메이커
            </h2>
            <p className="text-white/80 mb-6 text-lg">
              아름답고, 진정성 있으며, 믿을 수 있는 이야기를 모든 세대에서 만나보세요. 1080p & 4K Ultra로 제작하세요
            </p>
            <button className="px-10 py-4 bg-white text-[#6D14EC] rounded-full hover:bg-[#6D14EC] hover:text-[#F0D200] transition-all shadow-lg mb-8 text-lg" style={{ fontWeight: '600' }}>
              Anicreator 시작하기
            </button>
          </div>
          {/* Category Navigation - Overlapping */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-10">
            <div className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-xl rounded-full px-2 py-2 border border-white/10 shadow-2xl">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <NavButton 
                    key={category.id}
                    icon={<Icon className="w-5 h-5" />} 
                    label={category.label} 
                    active={selectedCategory === category.id}
                    onClick={() => handleCategoryChange(category.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Video Masonry Grid with Navigation */}
        <div className="relative">
          {/* Left Navigation Button */}
          {scrollPosition > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 z-20 w-12 h-12 rounded-full bg-[#F0D200] text-[#6D14EC] flex items-center justify-center shadow-xl hover:bg-[#6D14EC] hover:text-white transition-all hover:scale-110"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          
          {/* Right Navigation Button */}
          {scrollPosition < totalPages - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 z-20 w-12 h-12 rounded-full bg-[#F0D200] text-[#6D14EC] flex items-center justify-center shadow-xl hover:bg-[#6D14EC] hover:text-white transition-all hover:scale-110"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Masonry Grid Layout */}
          <div className="grid grid-cols-12 gap-3 auto-rows-[280px]">
            {currentPageVideos.map((video, index) => {
              // Define grid layouts based on index position
              const layouts = [
                { col: 'col-span-12 md:col-span-5', row: 'row-span-2' }, // Large - left
                { col: 'col-span-12 md:col-span-4', row: 'row-span-1' }, // Medium - top right
                { col: 'col-span-12 md:col-span-3', row: 'row-span-1' }, // Medium - top far right
                { col: 'col-span-6 md:col-span-4', row: 'row-span-1' },  // Small - bottom middle
                { col: 'col-span-6 md:col-span-3', row: 'row-span-1' },  // Small - bottom right
              ];
              
              const layout = layouts[index % layouts.length];
              
              return (
                <div
                  key={video.id}
                  className={`${layout.col} ${layout.row} relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]`}
                >
                  <ImageWithFallback
                    src={video.imageUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                      <div className="w-0 h-0 border-l-[16px] border-l-[#6D14EC] border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Page Indicators */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setScrollPosition(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  scrollPosition === index 
                    ? 'bg-[#6D14EC] w-8' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
