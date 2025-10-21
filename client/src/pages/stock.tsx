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
  const [statusFilter, setStatusFilter] = useState<"tous" | "en_stock" | "pas_en_stock">("tous");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openSubSections, setOpenSubSections] = useState<Set<string>>(new Set());

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

  const toggleSubSection = (categoryKey: string, subSectionKey: string) => {
    const newOpen = new Set(openSubSections);
    
    // Close all subsections in this category first
    const keysToRemove = Array.from(newOpen).filter(k => k.startsWith(`${categoryKey}-`));
    keysToRemove.forEach(k => newOpen.delete(k));
    
    // Toggle the clicked subsection
    const fullKey = `${categoryKey}-${subSectionKey}`;
    if (!openSubSections.has(fullKey)) {
      newOpen.add(fullKey);
    }
    
    setOpenSubSections(newOpen);
  };

  const filteredProducts = products
    .filter((p) => {
      // Filtrer les produits templates (invisibles)
      if (p.estTemplate) return false;
      
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
    })
    .sort((a, b) => {
      // Stock > 0 en premier, puis stock = 0
      // Dans chaque groupe, tri alphabétique
      if (a.stockActuel > 0 && b.stockActuel === 0) return -1;
      if (a.stockActuel === 0 && b.stockActuel > 0) return 1;
      return a.nom.localeCompare(b.nom);
    });

  // Grouper par catégorie puis par sous-section
  const groupedByCategory = filteredProducts.reduce((acc, product) => {
    if (!acc[product.categorie]) {
      acc[product.categorie] = {};
    }
    if (!acc[product.categorie][product.sousSection]) {
      acc[product.categorie][product.sousSection] = [];
    }
    acc[product.categorie][product.sousSection].push(product);
    return acc;
  }, {} as Record<string, Record<string, ProductWithStock[]>>);

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
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="tous" data-testid="filter-tous">Tous</TabsTrigger>
            <TabsTrigger value="en_stock" data-testid="filter-en-stock">En stock</TabsTrigger>
            <TabsTrigger value="pas_en_stock" data-testid="filter-pas-en-stock">Pas en stock</TabsTrigger>
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
            const sousSections = groupedByCategory[categorie];
            const isCategoryOpen = openCategories.has(categorie);
            
            // Get all products for this category
            const allCategoryProducts = Object.values(sousSections).flat();
            
            // Get sorted subsection names, with "Tous" first
            const subSectionNames = Object.keys(sousSections).sort((a, b) => {
              if (a === "Tous") return -1;
              if (b === "Tous") return 1;
              return a.localeCompare(b);
            });
            
            return (
              <Collapsible
                key={categorie}
                open={isCategoryOpen}
                onOpenChange={() => toggleCategory(categorie)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full" data-testid={`button-category-${categorie}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isCategoryOpen ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                          <h3 className="font-semibold text-left">{categorie}</h3>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {allCategoryProducts.length} produit{allCategoryProducts.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20">
                      {/* "Tous" virtual subsection - shows all products */}
                      <Collapsible
                        open={openSubSections.has(`${categorie}-Tous`)}
                        onOpenChange={() => toggleSubSection(categorie, "Tous")}
                      >
                        <CollapsibleTrigger className="w-full" data-testid={`button-subsection-${categorie}-Tous`}>
                          <div className="px-4 py-3 border-b hover-elevate">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {openSubSections.has(`${categorie}-Tous`) ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                                <h4 className="font-medium">Tous</h4>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {allCategoryProducts.length} produit{allCategoryProducts.length > 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="bg-background">
                            {allCategoryProducts.map((product) => (
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
                      </Collapsible>
                      
                      {/* Real subsections */}
                      {subSectionNames.filter(ss => ss !== "Tous").map((sousSection) => {
                        const subSectionProducts = sousSections[sousSection];
                        const subSectionKey = `${categorie}-${sousSection}`;
                        
                        return (
                          <Collapsible
                            key={subSectionKey}
                            open={openSubSections.has(subSectionKey)}
                            onOpenChange={() => toggleSubSection(categorie, sousSection)}
                          >
                            <CollapsibleTrigger className="w-full" data-testid={`button-subsection-${subSectionKey}`}>
                              <div className="px-4 py-3 border-b hover-elevate">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {openSubSections.has(subSectionKey) ? (
                                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <h4 className="font-medium">{sousSection}</h4>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {subSectionProducts.length} produit{subSectionProducts.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="bg-background">
                                {subSectionProducts.map((product) => (
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
                          </Collapsible>
                        );
                      })}
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
