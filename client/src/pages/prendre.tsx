import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Package, Minus, Plus, ShoppingCart, WifiOff } from "lucide-react";
import { StockBadge, StockIndicatorDot } from "@/components/stock-badge";
import { CreateProductForm } from "@/components/create-product-form";
import { CacheBadge } from "@/components/cache-badge";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { actionQueue } from "@/lib/actionQueue";
import type { ProductWithStock, CategoryInfo } from "@/lib/types";

type ViewMode = "categories" | "sous-sections" | "produits";

export default function Prendre() {
  const [, setLocation] = useLocation();
  const { currentUserId, currentUser } = useCurrentUser();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("");
  const [selectedSousSection, setSelectedSousSection] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [typeEmprunt, setTypeEmprunt] = useState<"pret" | "consommation">("pret");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showNewProductForm, setShowNewProductForm] = useState(false);

  if (!currentUser) {
    setLocation("/");
    return null;
  }

  // Récupérer les produits
  const { data: products = [] } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products"],
  });

  // Récupérer les catégories
  const { data: categories = [] } = useQuery<CategoryInfo[]>({
    queryKey: ["/api/categories"],
  });

  // Récupérer la liste pour compter les items
  const { data: listeData } = useQuery<{ liste: any; items: any[] }>({
    queryKey: ["/api/liste", currentUserId],
  });

  const listeCount = listeData?.items?.length || 0;

  // Mutation pour emprunter
  const borrowMutation = useMutation({
    mutationFn: async (data: { produitId: number; quantite: number; type: string }) => {
      return apiRequest("POST", "/api/movements/borrow", {
        ...data,
        utilisateurId: currentUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements/active"] });
      toast({
        title: "Emprunt enregistré",
        description: `${selectedProduct?.nom} × ${quantite} ${selectedProduct?.unite || ''}`,
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer l'emprunt",
        variant: "destructive",
      });
    },
  });

  // Mutation pour ajouter à la liste (utilisée uniquement en mode online)
  const addToListeMutation = useMutation({
    mutationFn: async (data: { produitId: number; quantite: number; typeAction: string; typeEmprunt: string; productNom: string }) => {
      return apiRequest("POST", "/api/liste/add", {
        userId: currentUserId,
        item: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      toast({
        title: "Ajouté à la liste",
        description: `${selectedProduct?.nom} × ${quantite} ${selectedProduct?.unite || ''}`,
      });
      setSelectedProduct(null);
      setQuantite(1);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter à la liste",
        variant: "destructive",
      });
    },
  });

  // Mutation pour vider la liste
  const clearListeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/liste/${currentUserId}/clear`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      setShowExitDialog(false);
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de vider la liste",
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products
    .filter((p) => {
      // Filtrer les produits templates (invisibles)
      if (p.estTemplate) return false;
      
      if (searchQuery) {
        return p.nom.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (viewMode === "produits" && selectedCategorie && selectedSousSection) {
        return p.categorie === selectedCategorie && p.sousSection === selectedSousSection;
      }
      return true;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

  const sousSections = selectedCategorie
    ? Array.from(new Set(products.filter((p) => p.categorie === selectedCategorie).map((p) => p.sousSection)))
        .sort((a, b) => {
          if (a === "Tous") return -1;
          if (b === "Tous") return 1;
          return a.localeCompare(b);
        })
    : [];

  // Auto-select movement type based on product restrictions
  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.typesMouvementsAutorises === "pret") {
        setTypeEmprunt("pret");
      } else if (selectedProduct.typesMouvementsAutorises === "consommation") {
        setTypeEmprunt("consommation");
      } else {
        // "les_deux" - keep default "pret"
        setTypeEmprunt("pret");
      }
    }
  }, [selectedProduct]);

  const handleValidate = () => {
    if (!selectedProduct) return;
    
    borrowMutation.mutate({
      produitId: selectedProduct.id,
      quantite,
      type: typeEmprunt,
    });
  };

  const handleAddToListe = () => {
    if (!selectedProduct) return;
    
    const currentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (!currentlyOnline) {
      const result = actionQueue.add(
        {
          productId: selectedProduct.id,
          productNom: selectedProduct.nom,
          quantite,
          typeAction: "prendre",
        },
        currentUserId!
      );
      
      if (result.success) {
        toast({
          title: "Ajouté à la liste (hors ligne)",
          description: `${selectedProduct.nom} sera synchronisé à la reconnexion`,
        });
        setSelectedProduct(null);
        setQuantite(1);
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Impossible d'ajouter à la file d'attente",
          variant: "destructive",
        });
      }
      return;
    }
    
    addToListeMutation.mutate({
      produitId: selectedProduct.id,
      quantite,
      typeAction: "prendre",
      typeEmprunt,
      productNom: selectedProduct.nom,
    });
  };

  const renderBreadcrumb = () => {
    const parts = [];
    if (selectedCategorie) parts.push(selectedCategorie);
    if (selectedSousSection) parts.push(selectedSousSection);
    if (selectedProduct) parts.push(selectedProduct.nom);
    
    return parts.length > 0 ? (
      <div className="text-sm text-muted-foreground truncate" data-testid="text-breadcrumb">
        {parts.join(" → ")}
      </div>
    ) : null;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader showBack={true} backPath="/" title="PRENDRE" />
      
      {/* Breadcrumb & Search */}
      <div className="bg-card border-b px-4 py-4 space-y-3">
        {renderBreadcrumb()}
        
        {/* Search Bar */}
        {!selectedProduct && !showNewProductForm && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-touch"
              data-testid="input-search-product"
            />
          </div>
        )}
      </div>

      <div className="px-4 py-6 space-y-4">
        {showNewProductForm ? (
          /* Formulaire de création de produit */
          <CreateProductForm
            currentUserId={currentUserId!}
            onSuccess={() => {
              setShowNewProductForm(false);
              setSearchQuery("");
            }}
            onCancel={() => setShowNewProductForm(false)}
            initialProductName={searchQuery}
          />
        ) : selectedProduct ? (
          /* Formulaire de prêt */
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
                  <span className="text-sm font-medium">Stock disponible:</span>
                  <StockBadge product={selectedProduct} />
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <Label htmlFor="quantite">Quantité ({selectedProduct.unite})</Label>
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
                      max={selectedProduct.stockDisponible}
                      value={quantite}
                      onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-center font-bold text-lg w-24"
                      data-testid="input-quantity"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantite(Math.min(selectedProduct.stockDisponible, quantite + 1))}
                      disabled={quantite >= selectedProduct.stockDisponible}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {quantite > selectedProduct.stockDisponible && (
                    <p className="text-sm text-[hsl(0,84%,60%)]">
                      Stock insuffisant (max: {selectedProduct.stockDisponible})
                    </p>
                  )}
                </div>

                {/* Type d'emprunt */}
                <div className="space-y-3">
                  <Label>Type</Label>
                  <RadioGroup value={typeEmprunt} onValueChange={(v) => setTypeEmprunt(v as "pret" | "consommation")}>
                    {(selectedProduct.typesMouvementsAutorises === "pret" || selectedProduct.typesMouvementsAutorises === "les_deux") && (
                      <div className="flex items-center space-x-2 min-h-touch">
                        <RadioGroupItem value="pret" id="pret" data-testid="radio-pret" />
                        <Label htmlFor="pret" className="cursor-pointer flex-1">
                          Prêt (à rendre)
                        </Label>
                      </div>
                    )}
                    {(selectedProduct.typesMouvementsAutorises === "consommation" || selectedProduct.typesMouvementsAutorises === "les_deux") && (
                      <div className="flex items-center space-x-2 min-h-touch">
                        <RadioGroupItem value="consommation" id="consommation" data-testid="radio-consommation" />
                        <Label htmlFor="consommation" className="cursor-pointer flex-1">
                          Consommation (définitif)
                        </Label>
                      </div>
                    )}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Badge cache si offline */}
            {!isOnline && (
              <div className="flex justify-center">
                <CacheBadge />
              </div>
            )}

            {/* Boutons d'action */}
            <div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAddToListe}
                disabled={addToListeMutation.isPending || quantite > selectedProduct.stockDisponible || quantite < 1}
                data-testid="button-add-to-cart"
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="h-5 w-5 mr-2" />
                    {addToListeMutation.isPending ? "Ajout..." : "AJOUTER (HORS LIGNE)"}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {addToListeMutation.isPending ? "Ajout..." : "AJOUTER À MA LISTE"}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : searchQuery ? (
          /* Résultats de recherche */
          filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-8 space-y-4">
                <p className="text-center text-muted-foreground">
                  Aucun produit trouvé pour "{searchQuery}"
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowNewProductForm(true);
                  }}
                  data-testid="button-create-new-product"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un nouveau produit
                </Button>
              </CardContent>
            </Card>
          ) : (
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
                        <div className="font-bold">
                          {product.stockDisponible}/{product.stockActuel}
                        </div>
                        <div className="text-xs text-muted-foreground">{product.unite}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : viewMode === "categories" ? (
          /* Liste des catégories */
          <div className="space-y-3">
            {categories.map((cat) => (
              <Card
                key={cat.categorie}
                className="hover-elevate cursor-pointer"
                onClick={() => {
                  setSelectedCategorie(cat.categorie);
                  setViewMode("sous-sections");
                }}
                data-testid={`card-category-${cat.categorie}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{cat.categorie}</h3>
                    <span className="text-sm text-muted-foreground">
                      {cat.count} produit{cat.count > 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : viewMode === "sous-sections" ? (
          /* Liste des sous-sections */
          <div className="space-y-3">
            {sousSections.map((ss) => {
              const count = products.filter((p) => p.categorie === selectedCategorie && p.sousSection === ss).length;
              return (
                <Card
                  key={ss}
                  className="hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedSousSection(ss);
                    setViewMode("produits");
                  }}
                  data-testid={`card-subsection-${ss}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{ss}</h3>
                      <span className="text-sm text-muted-foreground">
                        {count} produit{count > 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Liste des produits */
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
                      <p className="text-sm text-muted-foreground">{product.unite}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {product.stockDisponible}/{product.stockActuel}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modale de confirmation de sortie */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent data-testid="dialog-exit-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Vous avez {listeCount} article{listeCount > 1 ? 's' : ''} dans votre liste</AlertDialogTitle>
            <AlertDialogDescription>
              Que souhaitez-vous faire avec votre liste ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogCancel
              onClick={() => setShowExitDialog(false)}
              data-testid="button-continue-adding"
            >
              Continuer l'ajout
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                setLocation("/panier");
              }}
              data-testid="button-validate-list"
            >
              Valider ma liste
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => clearListeMutation.mutate()}
              disabled={clearListeMutation.isPending}
              data-testid="button-clear-list"
            >
              {clearListeMutation.isPending ? "Suppression..." : "Vider ma liste"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
