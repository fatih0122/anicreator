'use client';

import { StoryProvider } from './context/StoryContext';
import { AuthProvider } from './context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoryProvider>{children}</StoryProvider>
    </AuthProvider>
  );
}
