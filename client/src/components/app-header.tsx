import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { ShoppingCart, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  showBack?: boolean;
  backPath?: string;
  title?: string;
}

export function AppHeader({ showBack = false, backPath = "/", title }: AppHeaderProps) {
  const { currentUserId } = useCurrentUser();
  const [location] = useLocation();

  // Récupérer la liste
  const { data: listeData } = useQuery<{ liste: any; items: any[] }>({
    queryKey: ["/api/liste", currentUserId],
    enabled: !!currentUserId,
  });
  
  const listeCount = listeData?.items?.length || 0;

  // Ne pas afficher le badge panier sur la page panier elle-même
  const showBadge = location !== "/panier";

  return (
    <header className="bg-[hsl(var(--teal-principal))] text-white sticky top-0 z-10 shadow-md">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Link href={backPath}>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" data-testid="button-back">
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-xl font-semibold text-white">{title || "FiltrePlante"}</h1>
              {!title && <p className="text-sm text-white/80">Gestion de Stock</p>}
            </div>
          </div>
          
          {/* Liste Badge - affiché partout sauf sur /panier */}
          {showBadge && (
            <Link href="/panier">
              <div className="relative" data-testid="link-liste-header">
                <ShoppingCart className="h-6 w-6 text-white" data-testid="icon-liste-header" />
                {listeCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[hsl(var(--teal-secondaire))] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md" data-testid="badge-liste-count-header">
                    {listeCount}
                  </span>
                )}
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
