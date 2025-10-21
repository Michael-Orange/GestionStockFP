import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ListeItem, Product, Movement } from "@shared/schema";
import { formatUnite } from "@/lib/utils";

type ListeItemWithDetails = ListeItem & {
  product: Product | null;
  movement: Movement | null;
};

export default function Liste() {
  const { currentUserId } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get liste with items
  const { data, isLoading } = useQuery<{ liste: any; items: ListeItemWithDetails[] }>({
    queryKey: ["/api/liste", currentUserId],
    enabled: !!currentUserId,
  });

  const items = data?.items || [];
  const prendreItems = items.filter(item => item.typeAction === "prendre");
  const rendreItems = items.filter(item => item.typeAction === "rendre");
  const deposerItems = items.filter(item => item.typeAction === "deposer");
  const perdreItems = rendreItems.filter(item => (item.quantitePerdue || 0) > 0);

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await fetch(`/api/liste/item/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
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
        description: error.message || "Impossible de retirer l'article",
        variant: "destructive",
      });
    },
  });

  // Clear liste mutation
  const clearListeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/liste/${currentUserId}/clear`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
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
        description: error.message || "Impossible de vider la liste",
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
        description: error.message || "Impossible de valider la liste",
        variant: "destructive",
      });
    },
  });

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
        ) : items.length === 0 ? (
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
            {prendreItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-[hsl(142,71%,45%)]">
                  À PRENDRE ({prendreItems.length})
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
                              <span>Quantité: {item.quantite} {formatUnite(item.product?.unite || '')}</span>
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
                </div>
              </div>
            )}

            {/* Items à RENDRE */}
            {rendreItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-[hsl(217,91%,60%)]">
                  À RENDRE ({rendreItems.length})
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
                                <p>Quantité à rendre: {item.quantite} {formatUnite(item.product?.unite || '')}</p>
                              )}
                              {(item.quantitePerdue || 0) > 0 && (
                                <p className="text-destructive font-medium">
                                  Quantité perdue: {item.quantitePerdue} {formatUnite(item.product?.unite || '')}
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
            {deposerItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-[hsl(25,95%,53%)]">
                  À DÉPOSER ({deposerItems.length})
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
                            <p className="text-sm text-muted-foreground mt-1">
                              Quantité: {item.quantite} {formatUnite(item.product?.unite || '')}
                            </p>
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
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={() => validateListeMutation.mutate()}
                disabled={validateListeMutation.isPending}
                className="w-full h-14 text-lg"
                data-testid="button-validate"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {validateListeMutation.isPending ? "Validation..." : "Valider la liste"}
              </Button>

              <Button
                variant="destructive"
                onClick={() => clearListeMutation.mutate()}
                disabled={clearListeMutation.isPending}
                className="w-full h-12"
                data-testid="button-clear"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Vider la liste
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
