
"use client";

import type { User } from '@/lib/types';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string) => void; // Simplified login
  signup: (email: string) => void; // Simplified signup
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // To handle initial auth check

  useEffect(() => {
    // Simulate checking auth status from localStorage or an API
    const storedAuth = localStorage.getItem("aquafeed-auth");
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        if (authData.isAuthenticated && authData.user) {
          setIsAuthenticated(true);
          setUser(authData.user);
        }
      } catch (error) {
        // console.error("Failed to parse auth data from localStorage", error);
        localStorage.removeItem("aquafeed-auth");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (email: string) => {
    // In a real app, this would involve API calls, password validation, etc.
    const userData = { email };
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem("aquafeed-auth", JSON.stringify({ isAuthenticated: true, user: userData }));
  };

  const signup = (email: string) => {
    // In a real app, this would involve API calls, password handling, etc.
    // For this prototype, signup immediately logs the user in.
    login(email);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("aquafeed-auth");
    // Optionally redirect to home or login page
    // window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
