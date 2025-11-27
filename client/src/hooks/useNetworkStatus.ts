import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { actionQueue } from "@/lib/actionQueue";

interface NetworkStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
  pendingActionsCount: number;
}

let globalWasOffline = false;
let globalIsFlushing = false;

export function useNetworkStatus(): NetworkStatus & { refetchOnReconnect: () => void } {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const [pendingActionsCount, setPendingActionsCount] = useState(() => actionQueue.getCount());
  const { toast } = useToast();

  const refetchOnReconnect = useCallback(() => {
    queryClient.invalidateQueries();
  }, []);

  const flushPendingActions = useCallback(async () => {
    const count = actionQueue.getCount();
    if (count === 0 || globalIsFlushing) return;

    globalIsFlushing = true;

    toast({
      title: "Synchronisation en cours",
      description: `${count} action(s) en attente...`,
      duration: 5000,
    });

    try {
      const result = await actionQueue.flush((current, total) => {
        setPendingActionsCount(total - current);
      });

      setPendingActionsCount(actionQueue.getCount());

      if (result.success > 0) {
        toast({
          title: "Synchronisation réussie",
          description: `${result.success} action(s) effectuée(s)`,
          duration: 4000,
        });
      }

      if (result.failed > 0 && result.errors.length > 0) {
        const errorDetails = result.errors
          .slice(0, 3)
          .map(e => `• ${e.productNom}: ${e.reason}`)
          .join('\n');
        
        const moreText = result.errors.length > 3 
          ? `\n... et ${result.errors.length - 3} autre(s)` 
          : '';

        toast({
          title: `${result.failed} action(s) échouée(s)`,
          description: errorDetails + moreText,
          variant: "destructive",
          duration: 8000,
        });
      }

      refetchOnReconnect();
    } catch (error) {
      console.error("[NetworkStatus] Erreur flush:", error);
      toast({
        title: "Erreur de synchronisation",
        description: "Certaines actions n'ont pas pu être synchronisées",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      globalIsFlushing = false;
    }
  }, [toast, refetchOnReconnect]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      
      if (globalWasOffline) {
        toast({
          title: "Connexion rétablie",
          description: "Vérification des actions en attente...",
          duration: 3000,
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await flushPendingActions();
      }
      
      globalWasOffline = false;
    };

    const handleOffline = () => {
      setIsOnline(false);
      globalWasOffline = true;
      
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
  }, [toast, flushPendingActions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingActionsCount(actionQueue.getCount());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return { isOnline, lastOnlineAt, pendingActionsCount, refetchOnReconnect };
}
