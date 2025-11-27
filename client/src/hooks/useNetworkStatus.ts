import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface NetworkStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
}

export function useNetworkStatus(): NetworkStatus & { refetchOnReconnect: () => void } {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const wasOfflineRef = useRef(false);
  const { toast } = useToast();

  const refetchOnReconnect = useCallback(() => {
    queryClient.invalidateQueries();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      
      if (wasOfflineRef.current) {
        toast({
          title: "Connexion rétablie",
          description: "Synchronisation des données en cours...",
          duration: 3000,
        });
        
        refetchOnReconnect();
        
        setTimeout(() => {
          toast({
            title: "Données synchronisées",
            description: "Vos données sont à jour",
            duration: 2000,
          });
        }, 1500);
      }
      
      wasOfflineRef.current = false;
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      
      toast({
        title: "Connexion perdue",
        description: "Mode hors ligne - consultation depuis le cache",
        variant: "destructive",
        duration: 4000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, refetchOnReconnect]);

  return { isOnline, lastOnlineAt, refetchOnReconnect };
}
