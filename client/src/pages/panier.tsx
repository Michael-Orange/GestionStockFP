import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ShoppingCart, CheckCircle2, WifiOff, Clock, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient, getNetworkErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { CacheBadge } from "@/components/cache-badge";
import { actionQueue, type PendingAction } from "@/lib/actionQueue";
import { type ListeItem, type Product, type Movement } from "@shared/schema";

type ListeItemWithDetails = ListeItem & {
  product: Product | null;
  movement: Movement | null;
};

export default function Liste() {
  const { currentUserId } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  const [pendingItems, setPendingItems] = useState<PendingAction[]>([]);

  useEffect(() => {
    if (currentUserId) {
      setPendingItems(actionQueue.getPendingItemsForUser(currentUserId));
    }
  }, [currentUserId, isOnline]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUserId) {
        setPendingItems(actionQueue.getPendingItemsForUser(currentUserId));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  const { data, isLoading } = useQuery<{ liste: any; items: ListeItemWithDetails[] }>({
    queryKey: ["/api/liste", currentUserId],
    enabled: !!currentUserId,
  });

  const items = data?.items || [];
  const prendreItems = items.filter(item => item.typeAction === "prendre");
  const rendreItems = items.filter(item => item.typeAction === "rendre");
  const deposerItems = items.filter(item => item.typeAction === "deposer");
  const perdreItems = rendreItems.filter(item => (item.quantitePerdue || 0) > 0);

  const pendingPrendreItems = pendingItems.filter(p => p.payload.typeAction === "prendre");
  const pendingDeposerItems = pendingItems.filter(p => p.payload.typeAction === "deposer");
  const pendingRendreItems = pendingItems.filter(p => p.payload.typeAction === "rendre");
  const hasPendingItems = pendingItems.length > 0;

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await apiRequest("DELETE", `/api/liste/item/${itemId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      toast({
        title: "Article retiré",
        description: "L'article a été retiré de la liste",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: getNetworkErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Clear liste mutation
  const clearListeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/liste/${currentUserId}/clear`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      toast({
        title: "Liste vidée",
        description: "Tous les articles ont été retirés",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: getNetworkErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Validate liste mutation
  const validateListeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/liste/${currentUserId}/validate`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements/active", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      toast({
        title: "Validation réussie",
        description: `${data.results.length} opération(s) effectuée(s)`,
      });
      
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de validation",
        description: getNetworkErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleRemovePendingItem = (actionId: string) => {
    actionQueue.remove(actionId);
    setPendingItems(actionQueue.getPendingItemsForUser(currentUserId!));
    toast({
      title: "Item retiré",
      description: "L'item en attente a été supprimé",
    });
  };

  const getValidationTooltip = (): string | null => {
    if (!isOnline) return "Connexion internet requise pour valider";
    if (hasPendingItems) return "Synchronisez d'abord les items en attente";
    return null;
  };

  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Veuillez sélectionner un utilisateur</p>
            <Link href="/">
              <Button className="mt-4" data-testid="button-home">
                Retour à l'accueil
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader showBack={true} backPath="/" title="Ma liste" />

      <div className="px-4 py-6 space-y-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Chargement...
            </CardContent>
          </Card>
        ) : items.length === 0 && pendingItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Votre liste est vide</p>
              <Link href="/">
                <Button data-testid="button-home-empty">
                  Retour à l'accueil
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Items à PRENDRE */}
            {(prendreItems.length > 0 || pendingPrendreItems.length > 0) && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-[hsl(142,71%,45%)]">
                  À PRENDRE ({prendreItems.length + pendingPrendreItems.length})
                </h2>
                <div className="space-y-3">
                  {prendreItems.map((item) => (
                    <Card key={item.id} className="hover-elevate" data-testid={`card-item-${item.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate" data-testid={`text-product-${item.id}`}>
                              {item.product?.nom || "Produit inconnu"}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <span>Quantité: {item.quantite} {item.product?.unite || ''}</span>
                              <span>•</span>
                              <span className="capitalize">
                                {item.typeMouvement === "pret" ? "Prêt" : "Consommation"}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemMutation.mutate(item.id)}
                            disabled={removeItemMutation.isPending}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(0,84%,60%)]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pendingPrendreItems.map((pending) => (
                    <Card 
                      key={pending.id} 
                      className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                      data-testid={`card-pending-${pending.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate" data-testid={`text-pending-product-${pending.id}`}>
                                {pending.payload.productNom}
                              </h3>
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {pending.status === "failed" ? "Échec sync" : "En attente"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <span>Quantité: {pending.payload.quantite}</span>
                            </div>
                            {pending.errorMessage && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {pending.errorMessage}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePendingItem(pending.id)}
                            data-testid={`button-remove-pending-${pending.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(0,84%,60%)]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Items à RENDRE */}
            {(rendreItems.length > 0 || pendingRendreItems.length > 0) && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-[hsl(217,91%,60%)]">
                  À RENDRE ({rendreItems.length + pendingRendreItems.length})
                </h2>
                <div className="space-y-3">
                  {rendreItems.map((item) => (
                    <Card key={item.id} className="hover-elevate" data-testid={`card-item-${item.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate" data-testid={`text-product-${item.id}`}>
                              {item.product?.nom || "Produit inconnu"}
                            </h3>
                            <div className="text-sm text-muted-foreground mt-1 space-y-1">
                              {item.quantite > 0 && (
                                <p>Quantité à rendre: {item.quantite} {item.product?.unite || ''}</p>
                              )}
                              {(item.quantitePerdue || 0) > 0 && (
                                <p className="text-destructive font-medium">
                                  Quantité perdue: {item.quantitePerdue} {item.product?.unite || ''}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemMutation.mutate(item.id)}
                            disabled={removeItemMutation.isPending}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(0,84%,60%)]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pendingRendreItems.map((pending) => (
                    <Card 
                      key={pending.id} 
                      className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                      data-testid={`card-pending-${pending.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{pending.payload.productNom}</h3>
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {pending.status === "failed" ? "Échec sync" : "En attente"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <span>Quantité: {pending.payload.quantite}</span>
                            </div>
                            {pending.errorMessage && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {pending.errorMessage}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePendingItem(pending.id)}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(0,84%,60%)]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* MATÉRIEL PERDU */}
            {perdreItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-destructive">
                  MATÉRIEL PERDU ({perdreItems.length})
                </h2>
                <div className="space-y-3">
                  {perdreItems.map((item) => (
                    <Card key={`perdu-${item.id}`} className="border-destructive" data-testid={`card-lost-${item.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate text-destructive" data-testid={`text-lost-product-${item.id}`}>
                              {item.product?.nom || "Produit inconnu"}
                            </h3>
                            <p className="text-sm text-destructive/80 mt-1 font-medium">
                              Quantité perdue: {item.quantitePerdue} {item.product?.unite}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Items à DÉPOSER */}
            {(deposerItems.length > 0 || pendingDeposerItems.length > 0) && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-[hsl(25,95%,53%)]">
                  À DÉPOSER ({deposerItems.length + pendingDeposerItems.length})
                </h2>
                <div className="space-y-3">
                  {deposerItems.map((item) => (
                    <Card key={item.id} className="hover-elevate" data-testid={`card-item-${item.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate" data-testid={`text-product-${item.id}`}>
                              {item.product?.nom || "Produit inconnu"}
                            </h3>
                            <div className="text-sm text-muted-foreground mt-1 space-y-1">
                              <p>
                                Quantité: {item.quantite} {item.product?.unite || ''}
                              </p>
                              {item.longueur && item.largeur && (
                                <p data-testid={`text-dimensions-${item.id}`}>
                                  Dimensions: {item.longueur}m × {item.largeur}m
                                </p>
                              )}
                              {item.longueur && !item.largeur && (
                                <p data-testid={`text-longueur-${item.id}`}>
                                  Longueur: {item.longueur}m
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemMutation.mutate(item.id)}
                            disabled={removeItemMutation.isPending}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(0,84%,60%)]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pendingDeposerItems.map((pending) => (
                    <Card 
                      key={pending.id} 
                      className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                      data-testid={`card-pending-${pending.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{pending.payload.productNom}</h3>
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {pending.status === "failed" ? "Échec sync" : "En attente"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 space-y-1">
                              <p>Quantité: {pending.payload.quantite}</p>
                              {pending.payload.longueur && pending.payload.largeur && (
                                <p>Dimensions: {pending.payload.longueur}m × {pending.payload.largeur}m</p>
                              )}
                              {pending.payload.longueur && !pending.payload.largeur && (
                                <p>Longueur: {pending.payload.longueur}m</p>
                              )}
                            </div>
                            {pending.errorMessage && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {pending.errorMessage}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePendingItem(pending.id)}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(0,84%,60%)]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Badge cache si offline */}
            {!isOnline && (
              <div className="flex justify-center">
                <CacheBadge />
              </div>
            )}

            {/* Message si items en attente */}
            {hasPendingItems && isOnline && (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-orange-700 dark:text-orange-400">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">{pendingItems.length} item(s) en attente de synchronisation</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Attendez la synchronisation automatique ou connectez-vous à internet
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={() => validateListeMutation.mutate()}
                disabled={validateListeMutation.isPending || !isOnline || hasPendingItems}
                className="w-full h-14 text-lg"
                data-testid="button-validate"
                title={getValidationTooltip() || undefined}
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="h-5 w-5 mr-2" />
                    Hors ligne
                  </>
                ) : hasPendingItems ? (
                  <>
                    <Clock className="h-5 w-5 mr-2" />
                    Synchronisation requise
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {validateListeMutation.isPending ? "Validation..." : "Valider la liste"}
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                onClick={() => clearListeMutation.mutate()}
                disabled={clearListeMutation.isPending || !isOnline}
                className="w-full h-12"
                data-testid="button-clear"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {!isOnline ? "Hors ligne" : "Vider la liste"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
