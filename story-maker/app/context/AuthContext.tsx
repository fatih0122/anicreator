'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  user: { email: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const authStatus = localStorage.getItem('story-maker-auth');
    const userEmail = localStorage.getItem('story-maker-user');

    if (authStatus === 'true' && userEmail) {
      setIsAuthenticated(true);
      setUser({ email: userEmail });
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, password: string): boolean => {
    // Get admin credentials from environment variables
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    // Validate credentials
    if (email === adminEmail && password === adminPassword) {
      setIsAuthenticated(true);
      setUser({ email });

      // Store authentication status in localStorage
      localStorage.setItem('story-maker-auth', 'true');
      localStorage.setItem('story-maker-user', email);

      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);

    // Clear authentication from localStorage
    localStorage.removeItem('story-maker-auth');
    localStorage.removeItem('story-maker-user');
  };

  // Don't render children until we've checked authentication status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
