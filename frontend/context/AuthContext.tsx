"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { login as apiLogin, register as apiRegister } from "@/lib/api";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("panicplan_token");
    if (stored) setToken(stored);
    setIsLoading(false);

    const handleForceLogout = () => setToken(null);
    window.addEventListener("panicplan:logout", handleForceLogout);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "panicplan_token") setToken(e.newValue);
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("panicplan:logout", handleForceLogout);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem("panicplan_token", res.access_token);
    setToken(res.access_token);
  };

  const register = async (email: string, password: string) => {
    const res = await apiRegister(email, password);
    localStorage.setItem("panicplan_token", res.access_token);
    setToken(res.access_token);
  };

  const logout = () => {
    localStorage.removeItem("panicplan_token");
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: !!token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
