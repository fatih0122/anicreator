'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function App() {
  const router = useRouter();

  useEffect(() => {
    // Redirect directly to the story creation flow
    router.replace('/create/start');
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
}
