'use client';

import { useEffect } from "react";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prevent body scrolling on create pages only
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-white">
      {children}
    </div>
  );
}
