import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Minus, Search, WifiOff } from "lucide-react";
import { StockBadge, StockIndicatorDot } from "@/components/stock-badge";
import { LoanDurationBadge } from "@/components/loan-duration-badge";
import { CreateProductForm } from "@/components/create-product-form";
import { CacheBadge } from "@/components/cache-badge";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { actionQueue } from "@/lib/actionQueue";
import type { ProductWithStock, CategoryInfo, ActiveLoan } from "@/lib/types";

type ViewMode = "categories" | "sous-sections" | "produits";

export default function Deposer() {
  const [, setLocation] = useLocation();
  const { currentUserId, currentUser } = useCurrentUser();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  // Tab state
  const [activeTab, setActiveTab] = useState("mes-emprunts");

  // Tab 1 & 2: Rendre workflow
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [returnQuantite, setReturnQuantite] = useState(1);
  const [lostQuantite, setLostQuantite] = useState(0);

  // Tab 3: Déposer workflow
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("");
  const [selectedSousSection, setSelectedSousSection] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [depositQuantite, setDepositQuantite] = useState(1);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [longueur, setLongueur] = useState<number | "">("");
  const [largeur, setLargeur] = useState<number | "">("");
  const [couleur, setCouleur] = useState("");
  const [couleurAutre, setCouleurAutre] = useState("");

  if (!currentUser) {
    setLocation("/");
    return null;
  }

  // Queries
  const { data: myLoans = [], isLoading: myLoansLoading } = useQuery<ActiveLoan[]>({
    queryKey: ["/api/movements/active", currentUserId],
  });

  const { data: allLoans = [], isLoading: allLoansLoading } = useQuery<ActiveLoan[]>({
    queryKey: ["/api/movements/active"],
  });

  const { data: products = [] } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery<CategoryInfo[]>({
    queryKey: ["/api/categories"],
  });

  // Mutations
  const addReturnToListeMutation = useMutation({
    mutationFn: async (data: { movementId: number; quantite: number; quantitePerdue: number }) => {
      return apiRequest("POST", "/api/liste/add", {
        userId: currentUserId,
        item: {
          typeAction: "rendre",
          movementId: data.movementId,
          quantite: data.quantite,
          quantitePerdue: data.quantitePerdue,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      const totalItems = returnQuantite + lostQuantite;
      const description = lostQuantite > 0 
        ? `${selectedLoan?.product.nom}: ${returnQuantite} ${selectedLoan?.product.unite || ''} à rendre, ${lostQuantite} perdu(s)`
        : `${selectedLoan?.product.nom} × ${returnQuantite} ${selectedLoan?.product.unite || ''} à rendre`;
      toast({
        title: "Ajouté à la liste",
        description,
      });
      setSelectedLoan(null);
      setReturnQuantite(1);
      setLostQuantite(0);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter à la liste",
        variant: "destructive",
      });
    },
  });

  const addDepositToListeMutation = useMutation({
    mutationFn: async (data: { produitId: number; quantite: number; longueur?: number; largeur?: number; couleur?: string; productNom: string }) => {
      return apiRequest("POST", "/api/liste/add", {
        userId: currentUserId,
        item: {
          typeAction: "deposer",
          produitId: data.produitId,
          quantite: data.quantite,
          longueur: data.longueur,
          largeur: data.largeur,
          couleur: data.couleur,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liste", currentUserId] });
      toast({
        title: "Ajouté à la liste",
        description: `${selectedProduct?.nom} × ${depositQuantite} ${selectedProduct?.unite || ''}`,
      });
      setSelectedProduct(null);
      setDepositQuantite(1);
      setLongueur("");
      setLargeur("");
      setCouleur("");
      setCouleurAutre("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter à la liste",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleReturn = () => {
    if (!selectedLoan) return;
    addReturnToListeMutation.mutate({
      movementId: selectedLoan.id,
      quantite: returnQuantite,
      quantitePerdue: lostQuantite,
    });
  };

  const handleAddDepositToListe = () => {
    if (!selectedProduct) return;
    
    // Validation pour les Géomembranes
    const isGeomembrane = selectedProduct.sousSection === "Géomembranes";
    if (isGeomembrane && (!longueur || !largeur)) {
      toast({
        title: "Dimensions manquantes",
        description: "Veuillez saisir la longueur et la largeur de la géomembrane",
        variant: "destructive",
      });
      return;
    }
    
    if (isGeomembrane && !couleur) {
      toast({
        title: "Couleur manquante",
        description: "Veuillez sélectionner la couleur de la géomembrane",
        variant: "destructive",
      });
      return;
    }
    
    if (isGeomembrane && couleur === "Autre" && !couleurAutre.trim()) {
      toast({
        title: "Couleur manquante",
        description: "Veuillez préciser la couleur",
        variant: "destructive",
      });
      return;
    }
    
    // Validation pour les JR "Rouleau partiellement utilisé"
    const isJRTemplate = selectedProduct.estTemplate && selectedProduct.nom.includes("Rouleau partiellement utilisé");
    if (isJRTemplate) {
      if (!longueur) {
        toast({
          title: "Longueur manquante",
          description: "Veuillez saisir la longueur du rouleau partiellement utilisé",
          variant: "destructive",
        });
        return;
      }
      if (longueur < 10) {
        toast({
          title: "Longueur trop courte",
          description: "Utilisez le produit Chute pour les longueurs inférieures à 10m",
          variant: "destructive",
        });
        return;
      }
      if (longueur >= 100) {
        toast({
          title: "Longueur trop importante",
          description: "Un rouleau utilisé ne peut pas dépasser 100m",
          variant: "destructive",
        });
        return;
      }
    }
    
    const finalCouleur = couleur === "Autre" ? couleurAutre : couleur;
    
    const currentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (!currentlyOnline) {
      const result = actionQueue.add(
        {
          productId: selectedProduct.id,
          productNom: selectedProduct.nom,
          quantite: depositQuantite,
          typeAction: "deposer",
          longueur: longueur || undefined,
          largeur: largeur || undefined,
        },
        currentUserId!
      );
      
      if (result.success) {
        toast({
          title: "Ajouté à la liste (hors ligne)",
          description: `${selectedProduct.nom} sera synchronisé à la reconnexion`,
        });
        setSelectedProduct(null);
        setDepositQuantite(1);
        setLongueur("");
        setLargeur("");
        setCouleur("");
        setCouleurAutre("");
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Impossible d'ajouter à la file d'attente",
          variant: "destructive",
        });
      }
      return;
    }
    
    addDepositToListeMutation.mutate({
      produitId: selectedProduct.id,
      quantite: depositQuantite,
      longueur: longueur || undefined,
      largeur: largeur || undefined,
      couleur: finalCouleur || undefined,
      productNom: selectedProduct.nom,
    });
  };

  const handleBack = () => {
    if (activeTab === "ajouter-stock") {
      if (selectedProduct || showNewProductForm) {
        setSelectedProduct(null);
        setShowNewProductForm(false);
        setDepositQuantite(1);
      } else if (selectedSousSection) {
        setSelectedSousSection("");
        setViewMode("sous-sections");
      } else if (selectedCategorie) {
        setSelectedCategorie("");
        setViewMode("categories");
      } else {
        setLocation("/");
      }
    } else {
      if (selectedLoan) {
        setSelectedLoan(null);
        setReturnQuantite(1);
        setLostQuantite(0);
      } else {
        setLocation("/");
      }
    }
  };

  // Tab 3: Filter products by search query or category/sous-section
  // NOTE: Templates are NOT filtered out here because users need to select them
  // (e.g., "Membrane PVC (Template)") to trigger dimension-based auto-product creation
  const filteredProducts = products
    .filter((p) => {
      if (searchQuery) {
        return p.nom.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (viewMode === "produits" && selectedCategorie && selectedSousSection) {
        return p.categorie === selectedCategorie && p.sousSection === selectedSousSection;
      }
      return false;
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

  // Breadcrumb for Tab 3
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
      <AppHeader showBack={true} backPath="/" title="DÉPOSER" />
      
      {/* Breadcrumb */}
      {activeTab === "ajouter-stock" && (
        <div className="bg-card border-b px-4 py-3">
          {renderBreadcrumb()}
        </div>
      )}

      <div className="px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6" data-testid="tabs-deposer">
            <TabsTrigger value="mes-emprunts" data-testid="tab-mes-emprunts">
              Mes emprunts
            </TabsTrigger>
            <TabsTrigger value="tous-emprunts" data-testid="tab-tous-emprunts">
              Tous les emprunts
            </TabsTrigger>
            <TabsTrigger value="ajouter-stock" data-testid="tab-ajouter-stock">
              Ajouter du stock
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MES EMPRUNTS */}
          <TabsContent value="mes-emprunts" className="space-y-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="quantite-return">Quantité à rendre</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setReturnQuantite(Math.max(0, returnQuantite - 1))}
                          disabled={returnQuantite <= 0}
                          data-testid="button-decrease-quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="quantite-return"
                          type="number"
                          min="0"
                          max={selectedLoan.quantite - lostQuantite}
                          value={returnQuantite}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setReturnQuantite(Math.max(0, Math.min(selectedLoan.quantite - lostQuantite, val)));
                          }}
                          className="text-center font-bold text-lg w-24"
                          data-testid="input-quantity"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setReturnQuantite(Math.min(selectedLoan.quantite - lostQuantite, returnQuantite + 1))}
                          disabled={returnQuantite >= (selectedLoan.quantite - lostQuantite)}
                          data-testid="button-increase-quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantite-perdue" className="text-destructive">Quantités perdues</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setLostQuantite(Math.max(0, lostQuantite - 1))}
                          disabled={lostQuantite <= 0}
                          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          data-testid="button-decrease-lost-quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="quantite-perdue"
                          type="number"
                          min="0"
                          max={selectedLoan.quantite - returnQuantite}
                          value={lostQuantite}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLostQuantite(Math.max(0, Math.min(selectedLoan.quantite - returnQuantite, val)));
                          }}
                          className="text-center font-bold text-lg w-24 border-destructive text-destructive focus-visible:ring-destructive"
                          data-testid="input-lost-quantity"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setLostQuantite(Math.min(selectedLoan.quantite - returnQuantite, lostQuantite + 1))}
                          disabled={lostQuantite >= (selectedLoan.quantite - returnQuantite)}
                          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          data-testid="button-increase-lost-quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {(returnQuantite + lostQuantite) < selectedLoan.quantite && (
                        <p className="text-sm text-muted-foreground">
                          Reste non comptabilisé: {selectedLoan.quantite - returnQuantite - lostQuantite} {selectedLoan.product.unite}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Badge cache si offline */}
                {!isOnline && (
                  <div className="flex justify-center">
                    <CacheBadge />
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleReturn}
                  disabled={addReturnToListeMutation.isPending || (returnQuantite + lostQuantite) <= 0 || (returnQuantite + lostQuantite) > selectedLoan.quantite || !isOnline}
                  data-testid="button-add-return-to-list"
                >
                  {!isOnline ? (
                    <>
                      <WifiOff className="h-5 w-5 mr-2" />
                      Hors ligne
                    </>
                  ) : (
                    addReturnToListeMutation.isPending ? "Ajout..." : "AJOUTER À MA LISTE"
                  )}
                </Button>
              </div>
            ) : (
              /* Liste des emprunts */
              <>
                {myLoansLoading ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Chargement...
                    </CardContent>
                  </Card>
                ) : myLoans.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucun emprunt à rendre
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {myLoans.map((loan) => (
                      <Card
                        key={loan.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedLoan(loan);
                          setReturnQuantite(loan.quantite);
                          setLostQuantite(0);
                        }}
                        data-testid={`card-loan-${loan.id}`}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-3">
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
          </TabsContent>

          {/* TAB 2: TOUS LES EMPRUNTS */}
          <TabsContent value="tous-emprunts" className="space-y-4">
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
                      <span className="text-sm font-medium">Emprunté par:</span>
                      <span className="font-bold">{selectedLoan.user?.nom}</span>
                    </div>

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

                    <div className="space-y-2">
                      <Label htmlFor="quantite-return-all">Quantité à rendre</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setReturnQuantite(Math.max(0, returnQuantite - 1))}
                          disabled={returnQuantite <= 0}
                          data-testid="button-decrease-quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="quantite-return-all"
                          type="number"
                          min="0"
                          max={selectedLoan.quantite - lostQuantite}
                          value={returnQuantite}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setReturnQuantite(Math.max(0, Math.min(selectedLoan.quantite - lostQuantite, val)));
                          }}
                          className="text-center font-bold text-lg w-24"
                          data-testid="input-quantity"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setReturnQuantite(Math.min(selectedLoan.quantite - lostQuantite, returnQuantite + 1))}
                          disabled={returnQuantite >= (selectedLoan.quantite - lostQuantite)}
                          data-testid="button-increase-quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantite-perdue-all" className="text-destructive">Quantités perdues</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setLostQuantite(Math.max(0, lostQuantite - 1))}
                          disabled={lostQuantite <= 0}
                          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          data-testid="button-decrease-lost-quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="quantite-perdue-all"
                          type="number"
                          min="0"
                          max={selectedLoan.quantite - returnQuantite}
                          value={lostQuantite}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLostQuantite(Math.max(0, Math.min(selectedLoan.quantite - returnQuantite, val)));
                          }}
                          className="text-center font-bold text-lg w-24 border-destructive text-destructive focus-visible:ring-destructive"
                          data-testid="input-lost-quantity"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setLostQuantite(Math.min(selectedLoan.quantite - returnQuantite, lostQuantite + 1))}
                          disabled={lostQuantite >= (selectedLoan.quantite - returnQuantite)}
                          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          data-testid="button-increase-lost-quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {(returnQuantite + lostQuantite) < selectedLoan.quantite && (
                        <p className="text-sm text-muted-foreground">
                          Reste non comptabilisé: {selectedLoan.quantite - returnQuantite - lostQuantite} {selectedLoan.product.unite}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Badge cache si offline */}
                {!isOnline && (
                  <div className="flex justify-center">
                    <CacheBadge />
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleReturn}
                  disabled={addReturnToListeMutation.isPending || (returnQuantite + lostQuantite) <= 0 || (returnQuantite + lostQuantite) > selectedLoan.quantite || !isOnline}
                  data-testid="button-add-return-to-list"
                >
                  {!isOnline ? (
                    <>
                      <WifiOff className="h-5 w-5 mr-2" />
                      Hors ligne
                    </>
                  ) : (
                    addReturnToListeMutation.isPending ? "Ajout..." : "AJOUTER À MA LISTE"
                  )}
                </Button>
              </div>
            ) : (
              /* Liste de tous les emprunts */
              <>
                {allLoansLoading ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Chargement...
                    </CardContent>
                  </Card>
                ) : allLoans.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucun emprunt en cours
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {allLoans.map((loan) => (
                      <Card
                        key={loan.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedLoan(loan);
                          setReturnQuantite(loan.quantite);
                          setLostQuantite(0);
                        }}
                        data-testid={`card-loan-${loan.id}`}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{loan.product.nom}</h3>
                              <p className="text-sm text-muted-foreground">
                                Par: {loan.user?.nom} · {loan.quantite} {loan.product.unite}
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
          </TabsContent>

          {/* TAB 3: AJOUTER DU STOCK */}
          <TabsContent value="ajouter-stock" className="space-y-4">
            {/* Barre de recherche */}
            {!showNewProductForm && !selectedProduct && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-touch"
                  data-testid="input-search-product"
                />
              </div>
            )}

            {showNewProductForm ? (
              /* Formulaire de création de produit */
              <CreateProductForm
                currentUserId={currentUserId!}
                onSuccess={() => {
                  setShowNewProductForm(false);
                }}
                onCancel={() => setShowNewProductForm(false)}
              />
            ) : selectedProduct ? (
              /* Formulaire de dépôt */
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Package className="h-5 w-5" />
                      {selectedProduct.estTemplate ? `Nouvelle ${selectedProduct.nom}` : selectedProduct.nom}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Stock actuel:</span>
                      <StockBadge product={selectedProduct} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantite-deposit">Quantité à ajouter ({selectedProduct.unite})</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDepositQuantite(Math.max(1, depositQuantite - 1))}
                          disabled={depositQuantite <= 1}
                          data-testid="button-decrease-quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="quantite-deposit"
                          type="number"
                          min="1"
                          value={depositQuantite}
                          onChange={(e) => setDepositQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                          className="text-center font-bold text-lg w-24"
                          data-testid="input-quantity"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDepositQuantite(depositQuantite + 1)}
                          data-testid="button-increase-quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Nouveau stock: {selectedProduct.stockActuel + depositQuantite} {selectedProduct.unite}
                      </p>
                    </div>

                    {/* Dimensions pour Géomembranes */}
                    {selectedProduct.sousSection === "Géomembranes" && (
                      <div className="space-y-4 border-t pt-4">
                        <h3 className="font-semibold">Dimensions de la géomembrane</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="longueur">Longueur (m) *</Label>
                            <Input
                              id="longueur"
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={longueur}
                              onChange={(e) => setLongueur(parseFloat(e.target.value) || "")}
                              placeholder="Ex: 10"
                              className="min-h-touch"
                              data-testid="input-longueur"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="largeur">Largeur (m) *</Label>
                            <Input
                              id="largeur"
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={largeur}
                              onChange={(e) => setLargeur(parseFloat(e.target.value) || "")}
                              placeholder="Ex: 50"
                              className="min-h-touch"
                              data-testid="input-largeur"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="couleur">Couleur *</Label>
                          <Select value={couleur} onValueChange={setCouleur}>
                            <SelectTrigger id="couleur" className="min-h-touch" data-testid="select-couleur">
                              <SelectValue placeholder="Sélectionner une couleur" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Vert">Vert</SelectItem>
                              <SelectItem value="Blanc">Blanc</SelectItem>
                              <SelectItem value="Marron">Marron</SelectItem>
                              <SelectItem value="Noir">Noir</SelectItem>
                              <SelectItem value="Gris">Gris</SelectItem>
                              <SelectItem value="Abimé">Abimé</SelectItem>
                              <SelectItem value="Autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {couleur === "Autre" && (
                          <div className="space-y-2">
                            <Label htmlFor="couleur-autre">Préciser la couleur *</Label>
                            <Input
                              id="couleur-autre"
                              type="text"
                              value={couleurAutre}
                              onChange={(e) => setCouleurAutre(e.target.value)}
                              placeholder="Ex: Bleu clair"
                              className="min-h-touch"
                              data-testid="input-couleur-autre"
                            />
                          </div>
                        )}
                        
                        <p className="text-sm text-muted-foreground">
                          Un produit sera créé automatiquement: "{selectedProduct.nom.replace(' (Template)', '')} {longueur && largeur && (couleur === "Autre" ? couleurAutre : couleur) ? `${Math.min(longueur, largeur)}mx${Math.max(longueur, largeur)}m - ${couleur === "Autre" ? couleurAutre : couleur}` : ''}"
                        </p>
                      </div>
                    )}
                    
                    {/* Longueur pour JR "Rouleau partiellement utilisé" */}
                    {selectedProduct.estTemplate && selectedProduct.nom.includes("Rouleau partiellement utilisé") && (
                      <div className="space-y-4 border-t pt-4">
                        <h3 className="font-semibold">Longueur du rouleau</h3>
                        <div className="space-y-2">
                          <Label htmlFor="longueur-jr">Longueur (m) *</Label>
                          <Input
                            id="longueur-jr"
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={longueur}
                            onChange={(e) => setLongueur(parseFloat(e.target.value) || "")}
                            placeholder="Ex: 37"
                            className="min-h-touch"
                            data-testid="input-longueur-jr"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Un produit sera créé automatiquement: "{selectedProduct.nom.replace(' (Rouleau partiellement utilisé)', '')} {longueur ? `(${longueur}m)` : ''}"
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Badge cache si offline */}
                {!isOnline && (
                  <div className="flex justify-center">
                    <CacheBadge />
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAddDepositToListe}
                  disabled={addDepositToListeMutation.isPending || depositQuantite < 1}
                  data-testid="button-add-deposit-to-liste"
                >
                  {!isOnline ? (
                    <>
                      <WifiOff className="h-5 w-5 mr-2" />
                      {addDepositToListeMutation.isPending ? "Ajout..." : "AJOUTER (HORS LIGNE)"}
                    </>
                  ) : (
                    addDepositToListeMutation.isPending ? "Ajout..." : "Ajouter à ma liste"
                  )}
                </Button>
              </div>
            ) : searchQuery ? (
              /* Résultats de recherche */
              <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucun produit trouvé pour "{searchQuery}"
                    </CardContent>
                  </Card>
                ) : (
                  filteredProducts.map((product) => (
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
                            <h3 className="font-semibold truncate">
                              {product.estTemplate ? `Nouvelle ${product.nom}` : product.nom}
                            </h3>
                            <p className="text-sm text-muted-foreground">{product.unite}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{product.stockActuel}</div>
                            <div className="text-xs text-muted-foreground">stock</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
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
              /* Liste des produits (INCLUDING stock=0!) */
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
                          <h3 className="font-semibold truncate">
                            {product.estTemplate ? `Nouvelle ${product.nom}` : product.nom}
                          </h3>
                          <p className="text-sm text-muted-foreground">{product.unite}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{product.stockActuel}</div>
                          <div className="text-xs text-muted-foreground">stock</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
