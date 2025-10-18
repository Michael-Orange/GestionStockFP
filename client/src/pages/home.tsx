import { useCurrentUser } from "@/lib/user-context";
import { UserSelector } from "@/components/user-selector";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowDownToLine, ClipboardList, ShoppingCart } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { currentUser, currentUserId } = useCurrentUser();
  
  // Récupérer la liste pour afficher le bouton CTA
  const { data: listeResponse } = useQuery<{ liste: any; items: any[] }>({
    queryKey: currentUserId ? [`/api/liste/${currentUserId}`] : ['liste-disabled'],
    enabled: !!currentUserId,
  });
  
  const listeCount = listeResponse?.items?.length || 0;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">FiltrePlante</CardTitle>
            <p className="text-center text-muted-foreground">Gestion de Stock</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Sélectionnez votre nom pour commencer
            </p>
            <UserSelector listeCount={0} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      
      {/* User Selector */}
      <div className="px-4 py-4 border-b bg-card">
        <UserSelector listeCount={listeCount} />
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Action Buttons */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/prendre">
              <Button className="w-full h-24 flex-col gap-2 bg-[hsl(var(--teal-principal))] hover:bg-[hsl(var(--teal-principal))]/90 text-white border-0 rounded-xl shadow-md" size="lg" data-testid="button-prendre">
                <ArrowDownToLine className="h-6 w-6" />
                <span className="text-base font-medium">PRENDRE</span>
              </Button>
            </Link>
            <Link href="/deposer">
              <Button className="w-full h-24 flex-col gap-2 bg-[hsl(var(--teal-secondaire))] hover:bg-[hsl(var(--teal-secondaire))]/90 text-white border-0 rounded-xl shadow-md" size="lg" data-testid="button-deposer">
                <Package className="h-6 w-6" />
                <span className="text-base font-medium">DÉPOSER</span>
              </Button>
            </Link>
          </div>
          <Link href="/stock">
            <Button className="w-full h-24 flex-col gap-2 bg-[hsl(var(--beige-terre))]/80 hover:bg-[hsl(var(--beige-terre))]/70 text-white border-0 rounded-xl shadow-md" size="lg" data-testid="button-stock">
              <ClipboardList className="h-6 w-6" />
              <span className="text-base font-medium">STOCK</span>
            </Button>
          </Link>
        </div>

        {/* Admin Link */}
        {currentUser.role === "admin" && (
          <Link href="/admin">
            <Button variant="secondary" className="w-full min-h-touch" data-testid="button-admin">
              Interface Administrateur
            </Button>
          </Link>
        )}
      </div>

      {/* Bouton CTA "Valider ma liste" - affiché uniquement si liste non vide */}
      {listeCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg">
          <Link href="/panier">
            <Button 
              className="w-full bg-[hsl(var(--teal-principal))] hover:bg-[hsl(var(--teal-principal))]/90 text-white rounded-xl shadow-md" 
              size="lg"
              data-testid="button-validate-liste-cta"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Valider ma liste ({listeCount} {listeCount === 1 ? "item" : "items"})
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
