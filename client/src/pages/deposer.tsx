import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Search, Package, Plus, Minus } from "lucide-react";
import { StockBadge, StockIndicatorDot } from "@/components/stock-badge";
import { CreateProductForm } from "@/components/create-product-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProductWithStock } from "@/lib/types";

export default function Deposer() {
  const [, setLocation] = useLocation();
  const { currentUserId, currentUser } = useCurrentUser();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [quantite, setQuantite] = useState(1);

  if (!currentUser) {
    setLocation("/");
    return null;
  }

  // Récupérer les produits
  const { data: products = [] } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products"],
  });

  // Mutation pour déposer du stock
  const depositMutation = useMutation({
    mutationFn: async (data: { produitId: number; quantite: number }) => {
      return apiRequest("POST", "/api/movements/deposit", {
        ...data,
        utilisateurId: currentUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Dépôt enregistré",
        description: `${selectedProduct?.nom} × ${quantite} ${selectedProduct?.unite}`,
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer le dépôt",
        variant: "destructive",
      });
    },
  });

  const filteredProducts = searchQuery
    ? products.filter((p) => p.nom.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const handleDeposit = () => {
    if (!selectedProduct) return;
    
    depositMutation.mutate({
      produitId: selectedProduct.id,
      quantite,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (selectedProduct || showNewProductForm) {
                  setSelectedProduct(null);
                  setShowNewProductForm(false);
                  setQuantite(1);
                } else {
                  setLocation("/");
                }
              }}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Déposer</h1>
          </div>

          {/* Search Bar */}
          {!selectedProduct && !showNewProductForm && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher ou créer un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 min-h-touch"
                data-testid="input-search-product"
              />
            </div>
          )}
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {selectedProduct ? (
          /* Formulaire de dépôt */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Package className="h-5 w-5" />
                  {selectedProduct.nom}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stock actuel:</span>
                  <StockBadge product={selectedProduct} />
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <Label htmlFor="quantite">Quantité à ajouter</Label>
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
                      value={quantite}
                      onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-center font-bold text-lg w-24"
                      data-testid="input-quantity"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantite(quantite + 1)}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nouveau stock: {selectedProduct.stockActuel + quantite} {selectedProduct.unite}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={handleDeposit}
              disabled={depositMutation.isPending || quantite < 1}
              data-testid="button-validate-deposit"
            >
              {depositMutation.isPending ? "Enregistrement..." : "VALIDER"}
            </Button>
          </div>
        ) : showNewProductForm ? (
          /* Formulaire de création de produit */
          <CreateProductForm
            currentUserId={currentUserId!}
            onSuccess={() => {
              setShowNewProductForm(false);
              setLocation("/");
            }}
            onCancel={() => setShowNewProductForm(false)}
            initialProductName={searchQuery}
          />
        ) : (
          /* Résultats de recherche ou bouton créer */
          <>
            {searchQuery && filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-8 space-y-4">
                  <p className="text-center text-muted-foreground">
                    Aucun produit trouvé pour "{searchQuery}"
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowNewProductForm(true)}
                    data-testid="button-create-new-product"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Créer un nouveau produit
                  </Button>
                </CardContent>
              </Card>
            ) : searchQuery ? (
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                    data-testid={`card-product-${product.id}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <StockIndicatorDot status={product.stockStatus} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{product.nom}</h3>
                          <p className="text-sm text-muted-foreground">
                            {product.categorie} → {product.sousSection}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{product.stockActuel}</div>
                          <div className="text-xs text-muted-foreground">{product.unite}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowNewProductForm(true)}
                  data-testid="button-create-new-product"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un nouveau produit
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium mb-2">Rechercher un produit existant</p>
                    <p className="text-sm text-muted-foreground">
                      ou créer un nouveau produit
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
