import { createContext, useContext, useState, useEffect } from "react";
import { TEAM_MEMBERS } from "./types";

interface UserContextType {
  currentUserId: number | null;
  setCurrentUserId: (id: number | null) => void;
  currentUser: typeof TEAM_MEMBERS[number] | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem("filtreplante_current_user");
    return stored ? parseInt(stored) : null;
  });

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem("filtreplante_current_user", currentUserId.toString());
    } else {
      localStorage.removeItem("filtreplante_current_user");
    }
  }, [currentUserId]);

  const currentUser = currentUserId 
    ? TEAM_MEMBERS.find(m => m.id === currentUserId) || null
    : null;

  return (
    <UserContext.Provider value={{ currentUserId, setCurrentUserId, currentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useCurrentUser must be used within a UserProvider");
  }
  return context;
}
