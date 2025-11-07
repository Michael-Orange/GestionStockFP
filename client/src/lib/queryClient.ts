import { QueryClient, QueryFunction } from "@tanstack/react-query";

export function getNetworkErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  
  if (message.includes('failed to fetch') || message.includes('network')) {
    return "Problème de connexion réseau. Vérifiez votre connexion et réessayez.";
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return "La demande prend trop de temps. Vérifiez votre connexion.";
  }
  
  if (message.includes('500') || message.includes('503')) {
    return "Le serveur rencontre un problème. Réessayez dans quelques instants.";
  }
  
  if (message.includes('400')) {
    return "Données invalides. Vérifiez votre saisie.";
  }
  
  if (message.includes('401') || message.includes('403')) {
    return "Accès non autorisé.";
  }
  
  if (message.includes('404')) {
    return "Ressource introuvable.";
  }
  
  return error.message || "Une erreur s'est produite. Réessayez.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        if (failureCount > 2) return false;
        const err = error as Error;
        if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('404')) {
          return false;
        }
        return true;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        if (failureCount > 2) return false;
        const err = error as Error;
        if (err.message?.includes('400') || err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('404')) {
          return false;
        }
        return true;
      },
    },
  },
});
