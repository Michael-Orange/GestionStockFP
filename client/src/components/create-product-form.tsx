import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CategoryInfo } from "@/lib/types";

interface CreateProductFormProps {
  currentUserId: number;
  onSuccess: () => void;
  onCancel: () => void;
  initialProductName?: string;
}

export function CreateProductForm({
  currentUserId,
  onSuccess,
  onCancel,
  initialProductName = "",
}: CreateProductFormProps) {
  const { toast } = useToast();

  const [newProductName, setNewProductName] = useState(initialProductName);
  const [newProductCategorie, setNewProductCategorie] = useState("");
  const [newCategorieInput, setNewCategorieInput] = useState("");
  const [newProductSousSection, setNewProductSousSection] = useState("");
  const [newSousSectionInput, setNewSousSectionInput] = useState("");
  const [newProductUnite, setNewProductUnite] = useState("u");
  const [newProductQuantite, setNewProductQuantite] = useState(1);

  // Récupérer les catégories
  const { data: categories = [] } = useQuery<CategoryInfo[]>({
    queryKey: ["/api/categories"],
  });

  // Récupérer les sous-sections pour la catégorie sélectionnée
  const { data: sousSections = [] } = useQuery<string[]>({
    queryKey: ["/api/categories", newProductCategorie, "sous-sections"],
    enabled: !!newProductCategorie && newProductCategorie !== "__nouvelle__",
  });

  // Mutation pour créer un nouveau produit
  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/products", {
        ...data,
        creePar: currentUserId,
        statut: "en_attente",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Produit créé",
        description: "En attente de validation par l'administrateur",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le produit",
        variant: "destructive",
      });
    },
  });

  const handleCreateProduct = () => {
    if (!newProductName || !newProductCategorie || !newProductSousSection) return;
    
    const finalCategorie = newProductCategorie === "__nouvelle__" ? newCategorieInput : newProductCategorie;
    const finalSousSection = newProductSousSection === "__nouvelle__" ? newSousSectionInput : newProductSousSection;
    
    // Validation défensive: ne pas envoyer de chaînes vides
    if (!finalCategorie.trim() || !finalSousSection.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }
    
    createProductMutation.mutate({
      nom: newProductName,
      categorie: finalCategorie,
      sousSection: finalSousSection,
      unite: newProductUnite,
      stockActuel: newProductQuantite,
      stockMinimum: 0,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau produit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du produit *</Label>
            <Input
              id="nom"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Ex: MARTEAU"
              className="min-h-touch"
              data-testid="input-product-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categorie">Catégorie *</Label>
            <Select value={newProductCategorie} onValueChange={setNewProductCategorie}>
              <SelectTrigger className="min-h-touch" data-testid="select-category">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.categorie} value={cat.categorie}>
                    {cat.categorie}
                  </SelectItem>
                ))}
                <SelectItem value="__nouvelle__">Nouvelle catégorie...</SelectItem>
              </SelectContent>
            </Select>
            {newProductCategorie === "__nouvelle__" && (
              <Input
                value={newCategorieInput}
                onChange={(e) => setNewCategorieInput(e.target.value)}
                placeholder="Nom de la catégorie"
                className="min-h-touch"
                data-testid="input-new-category"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sousSection">Sous-section *</Label>
            <Select value={newProductSousSection} onValueChange={setNewProductSousSection}>
              <SelectTrigger className="min-h-touch" data-testid="select-subsection">
                <SelectValue placeholder="Sélectionner une sous-section" />
              </SelectTrigger>
              <SelectContent>
                {sousSections.map((sousSection) => (
                  <SelectItem key={sousSection} value={sousSection}>
                    {sousSection}
                  </SelectItem>
                ))}
                <SelectItem value="__nouvelle__">Nouvelle sous-section...</SelectItem>
              </SelectContent>
            </Select>
            {newProductSousSection === "__nouvelle__" && (
              <Input
                value={newSousSectionInput}
                onChange={(e) => setNewSousSectionInput(e.target.value)}
                placeholder="Nom de la sous-section"
                className="min-h-touch"
                data-testid="input-new-subsection"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="unite">Unité *</Label>
            <Select value={newProductUnite} onValueChange={setNewProductUnite}>
              <SelectTrigger className="min-h-touch" data-testid="select-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="u">Unité (u)</SelectItem>
                <SelectItem value="m">Mètre (m)</SelectItem>
                <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                <SelectItem value="L">Litre (L)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantiteInitiale">Quantité initiale *</Label>
            <Input
              id="quantiteInitiale"
              type="number"
              min="1"
              value={newProductQuantite}
              onChange={(e) => setNewProductQuantite(Math.max(1, parseInt(e.target.value) || 1))}
              className="min-h-touch"
              data-testid="input-initial-quantity"
            />
          </div>

          <div className="bg-[hsl(217,91%,60%)]/10 border border-[hsl(217,91%,60%)]/20 rounded-md p-3">
            <p className="text-sm text-muted-foreground">
              Ce produit sera créé avec le statut "en attente" et devra être validé par un administrateur.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          size="lg"
          onClick={onCancel}
          disabled={createProductMutation.isPending}
          data-testid="button-cancel-create"
        >
          Annuler
        </Button>
        <Button
          className="flex-1"
          size="lg"
          onClick={handleCreateProduct}
          disabled={
            createProductMutation.isPending ||
            !newProductName ||
            !newProductCategorie ||
            (newProductCategorie === "__nouvelle__" && !newCategorieInput) ||
            !newProductSousSection ||
            (newProductSousSection === "__nouvelle__" && !newSousSectionInput)
          }
          data-testid="button-create-product"
        >
          {createProductMutation.isPending ? "Création..." : "CRÉER LE PRODUIT"}
        </Button>
      </div>
    </div>
  );
}
