import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { StockBadge, StockIndicatorDot } from "@/components/stock-badge";
import type { ProductWithStock } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function Stock() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"tous" | "ok" | "faible" | "vide">("tous");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // Récupérer les produits
  const { data: products = [], isLoading } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products"],
  });

  const toggleCategory = (category: string) => {
    const newOpen = new Set(openCategories);
    if (newOpen.has(category)) {
      newOpen.delete(category);
    } else {
      newOpen.add(category);
    }
    setOpenCategories(newOpen);
  };

  const filteredProducts = products.filter((p) => {
    // Filtre par recherche
    if (searchQuery && !p.nom.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Filtre par statut
    if (statusFilter !== "tous" && p.stockStatus !== statusFilter) {
      return false;
    }
    // Afficher seulement les produits validés
    if (p.statut !== "valide") {
      return false;
    }
    return true;
  });

  // Grouper par catégorie
  const groupedByCategory = filteredProducts.reduce((acc, product) => {
    if (!acc[product.categorie]) {
      acc[product.categorie] = [];
    }
    acc[product.categorie].push(product);
    return acc;
  }, {} as Record<string, ProductWithStock[]>);

  const categories = Object.keys(groupedByCategory).sort();

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader showBack={true} backPath="/" title="STOCK" />
      
      {/* Search & Filters */}
      <div className="bg-card border-b px-4 py-4 space-y-4">
        {/* Search Bar */}
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

        {/* Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="tous" data-testid="filter-tous">Tous</TabsTrigger>
            <TabsTrigger value="ok" data-testid="filter-ok">OK</TabsTrigger>
            <TabsTrigger value="faible" data-testid="filter-faible">Faible</TabsTrigger>
            <TabsTrigger value="vide" data-testid="filter-vide">Vide</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 py-6 space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Chargement...
            </CardContent>
          </Card>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun produit trouvé
            </CardContent>
          </Card>
        ) : (
          categories.map((categorie) => {
            const categoryProducts = groupedByCategory[categorie];
            const isOpen = openCategories.has(categorie);
            
            return (
              <Collapsible
                key={categorie}
                open={isOpen}
                onOpenChange={() => toggleCategory(categorie)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full" data-testid={`button-category-${categorie}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                          <h3 className="font-semibold text-left">{categorie}</h3>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {categoryProducts.length} produit{categoryProducts.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      {categoryProducts.map((product) => (
                        <div
                          key={product.id}
                          className="border-b last:border-b-0 px-4 py-3 hover-elevate"
                          data-testid={`product-${product.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <StockIndicatorDot status={product.stockStatus} />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{product.nom}</h4>
                              <p className="text-xs text-muted-foreground">
                                {product.sousSection}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <div className="font-bold text-sm">
                                {product.stockDisponible}/{product.stockActuel}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {product.unite}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}
