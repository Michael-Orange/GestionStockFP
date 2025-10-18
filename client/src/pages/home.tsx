import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { UserSelector } from "@/components/user-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowDownToLine, ArrowUpFromLine, ClipboardList, AlertCircle, ShoppingCart } from "lucide-react";
import { Link } from "wouter";
import { LoanDurationBadge } from "@/components/loan-duration-badge";
import type { ActiveLoan } from "@/lib/types";

export default function Home() {
  const { currentUserId, currentUser } = useCurrentUser();

  // Récupérer les emprunts en cours de l'utilisateur
  const { data: activeLoans = [], isLoading } = useQuery<ActiveLoan[]>({
    queryKey: ["/api/movements/active", currentUserId],
    enabled: !!currentUserId,
  });

  // Récupérer les alertes non lues
  const { data: unreadAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts/unread", currentUserId],
    enabled: !!currentUserId,
  });

  // Récupérer la liste
  const { data: listeData } = useQuery<{ liste: any; items: any[] }>({
    queryKey: ["/api/liste", currentUserId],
    enabled: !!currentUserId,
  });
  
  const listeCount = listeData?.items?.length || 0;

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
            <UserSelector />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">FiltrePlante</h1>
              <p className="text-sm text-muted-foreground">Gestion de Stock</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Liste Badge */}
              <Link href="/panier">
                <div className="relative" data-testid="link-liste">
                  <ShoppingCart className="h-6 w-6 text-primary" data-testid="icon-liste" />
                  {listeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center" data-testid="badge-liste-count">
                      {listeCount}
                    </span>
                  )}
                </div>
              </Link>
              {/* Alertes Badge */}
              {unreadAlerts.length > 0 && (
                <div className="relative">
                  <AlertCircle className="h-6 w-6 text-[hsl(0,84%,60%)]" data-testid="icon-alerts" />
                  <span className="absolute -top-1 -right-1 bg-[hsl(0,84%,60%)] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center" data-testid="badge-alert-count">
                    {unreadAlerts.length}
                  </span>
                </div>
              )}
            </div>
          </div>
          <UserSelector />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="hover-elevate">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary" data-testid="text-loan-count">
                  {activeLoans.length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Emprunt{activeLoans.length > 1 ? "s" : ""} en cours
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[hsl(25,95%,53%)]" data-testid="text-alert-count">
                  {unreadAlerts.length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Alerte{unreadAlerts.length > 1 ? "s" : ""}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mes emprunts en cours */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Mes emprunts en cours</h2>
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Chargement...
              </CardContent>
            </Card>
          ) : activeLoans.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucun emprunt en cours
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeLoans.map((loan) => (
                <Card key={loan.id} className="hover-elevate" data-testid={`card-loan-${loan.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate" data-testid={`text-product-${loan.produitId}`}>
                          {loan.product.nom}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Quantité: {loan.quantite} {loan.product.unite}
                        </p>
                      </div>
                      <LoanDurationBadge loan={loan} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/prendre">
              <Button className="w-full h-24 flex-col gap-2" size="lg" data-testid="button-prendre">
                <ArrowDownToLine className="h-6 w-6" />
                <span className="text-base font-medium">PRENDRE</span>
              </Button>
            </Link>
            <Link href="/deposer">
              <Button className="w-full h-24 flex-col gap-2" size="lg" variant="outline" data-testid="button-deposer">
                <Package className="h-6 w-6" />
                <span className="text-base font-medium">DÉPOSER</span>
              </Button>
            </Link>
          </div>
          <Link href="/stock">
            <Button className="w-full h-24 flex-col gap-2" size="lg" variant="outline" data-testid="button-stock">
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
    </div>
  );
}
