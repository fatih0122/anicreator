'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function App() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to projects page (home)
    router.replace('/projects');
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
}
