import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Package, Minus, Plus, ShoppingCart } from "lucide-react";
import { LoanDurationBadge } from "@/components/loan-duration-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ActiveLoan } from "@/lib/types";

export default function Rendre() {
  const [, setLocation] = useLocation();
  const { currentUserId, currentUser } = useCurrentUser();
  const { toast } = useToast();

  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [quantite, setQuantite] = useState(1);

  if (!currentUser) {
    setLocation("/");
    return null;
  }

  // Récupérer les emprunts en cours
  const { data: activeLoans = [], isLoading } = useQuery<ActiveLoan[]>({
    queryKey: ["/api/movements/active", currentUserId],
  });

  // Mutation pour retourner
  const returnMutation = useMutation({
    mutationFn: async (data: { mouvementId: number; quantite: number }) => {
      return apiRequest("POST", "/api/movements/return", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements/active"] });
      toast({
        title: "Retour enregistré",
        description: `${selectedLoan?.product.nom} × ${quantite} ${selectedLoan?.product.unite}`,
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer le retour",
        variant: "destructive",
      });
    },
  });

  // Mutation pour ajouter au panier
  const addToPanierMutation = useMutation({
    mutationFn: async (data: { mouvementId: number; quantite: number; typeAction: string }) => {
      return apiRequest("POST", "/api/panier/add", {
        userId: currentUserId,
        item: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/panier", currentUserId] });
      toast({
        title: "Ajouté au panier",
        description: `${selectedLoan?.product.nom} × ${quantite} ${selectedLoan?.product.unite}`,
      });
      // Reset pour continuer à ajouter d'autres retours
      setSelectedLoan(null);
      setQuantite(1);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter au panier",
        variant: "destructive",
      });
    },
  });

  const handleValidate = () => {
    if (!selectedLoan) return;
    
    returnMutation.mutate({
      mouvementId: selectedLoan.id,
      quantite,
    });
  };

  const handleAddToPanier = () => {
    if (!selectedLoan) return;
    
    addToPanierMutation.mutate({
      mouvementId: selectedLoan.id,
      quantite,
      typeAction: "rendre",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (selectedLoan) {
                  setSelectedLoan(null);
                  setQuantite(1);
                } else {
                  setLocation("/");
                }
              }}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Rendre</h1>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {selectedLoan ? (
          /* Formulaire de retour */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Package className="h-5 w-5" />
                  {selectedLoan.product.nom}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Durée d'emprunt:</span>
                  <LoanDurationBadge loan={selectedLoan} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Quantité empruntée:</span>
                  <span className="font-bold">
                    {selectedLoan.quantite} {selectedLoan.product.unite}
                  </span>
                </div>

                {/* Quantité à rendre */}
                <div className="space-y-2">
                  <Label htmlFor="quantite">Quantité à rendre</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantite(Math.max(1, quantite - 1))}
                      disabled={quantite <= 1}
                      data-testid="button-decrease-quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="quantite"
                      type="number"
                      min="1"
                      max={selectedLoan.quantite}
                      value={quantite}
                      onChange={(e) => setQuantite(Math.max(1, Math.min(selectedLoan.quantite, parseInt(e.target.value) || 1)))}
                      className="text-center font-bold text-lg w-24"
                      data-testid="input-quantity"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantite(Math.min(selectedLoan.quantite, quantite + 1))}
                      disabled={quantite >= selectedLoan.quantite}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {quantite < selectedLoan.quantite && (
                    <p className="text-sm text-muted-foreground">
                      Retour partiel. Reste: {selectedLoan.quantite - quantite} {selectedLoan.product.unite}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Boutons d'action */}
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleAddToPanier}
                disabled={addToPanierMutation.isPending || quantite < 1 || quantite > selectedLoan.quantite}
                data-testid="button-add-to-cart-return"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {addToPanierMutation.isPending ? "Ajout..." : "AJOUTER AU PANIER"}
              </Button>
              
              <Button
                className="w-full"
                size="lg"
                onClick={handleValidate}
                disabled={returnMutation.isPending || quantite < 1 || quantite > selectedLoan.quantite}
                data-testid="button-validate-return"
              >
                {returnMutation.isPending ? "Enregistrement..." : "VALIDER MAINTENANT"}
              </Button>
            </div>
          </div>
        ) : (
          /* Liste des emprunts */
          <>
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Chargement...
                </CardContent>
              </Card>
            ) : activeLoans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun emprunt à rendre
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeLoans.map((loan) => (
                  <Card
                    key={loan.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedLoan(loan);
                      setQuantite(loan.quantite);
                    }}
                    data-testid={`card-loan-${loan.id}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{loan.product.nom}</h3>
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
          </>
        )}
      </div>
    </div>
  );
}
