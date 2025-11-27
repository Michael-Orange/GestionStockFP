import { useState, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

const ADMIN_SESSION_KEY = "filtreplante_admin_verified_until";
const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 heures

interface UseAdminAuthReturn {
  isAdminVerified: () => boolean;
  verifyAdminPassword: (userId: number, password: string) => Promise<boolean>;
  requireAdminAccess: (action: () => Promise<void>) => Promise<void>;
  clearAdminSession: () => void;
  showPasswordModal: boolean;
  setShowPasswordModal: (show: boolean) => void;
  pendingAction: (() => Promise<void>) | null;
  executePendingAction: () => Promise<void>;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (stored) {
      const expiration = parseInt(stored, 10);
      if (Date.now() >= expiration) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
      }
    }
  }, []);

  const isAdminVerified = useCallback((): boolean => {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return false;
    
    const expiration = parseInt(stored, 10);
    if (Date.now() < expiration) {
      return true;
    }
    
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return false;
  }, []);

  const verifyAdminPassword = useCallback(async (userId: number, password: string): Promise<boolean> => {
    try {
      const response = await apiRequest("POST", "/api/auth/verify-admin", {
        userId,
        password,
      });
      
      const result = await response.json();
      
      if (result.success) {
        const expiration = Date.now() + ADMIN_SESSION_DURATION;
        localStorage.setItem(ADMIN_SESSION_KEY, expiration.toString());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Erreur vérification admin:", error);
      return false;
    }
  }, []);

  const requireAdminAccess = useCallback(async (action: () => Promise<void>): Promise<void> => {
    if (isAdminVerified()) {
      await action();
      return;
    }
    
    setPendingAction(() => action);
    setShowPasswordModal(true);
  }, [isAdminVerified]);

  const executePendingAction = useCallback(async (): Promise<void> => {
    if (pendingAction) {
      await pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const clearAdminSession = useCallback((): void => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }, []);

  return {
    isAdminVerified,
    verifyAdminPassword,
    requireAdminAccess,
    clearAdminSession,
    showPasswordModal,
    setShowPasswordModal,
    pendingAction,
    executePendingAction,
  };
}
