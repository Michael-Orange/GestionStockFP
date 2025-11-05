import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/user-context";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, X, Edit, AlertTriangle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProductWithStock } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();

  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editStockMin, setEditStockMin] = useState(0);

  if (!currentUser || currentUser.role !== "admin") {
    setLocation("/");
    return null;
  }

  // Récupérer les produits en attente
  const { data: pendingProducts = [], isLoading } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products/pending"],
  });

  // Mutation pour valider un produit
  const validateMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("POST", `/api/products/${productId}/validate`, {
        userId: currentUser?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/pending"] });
      toast({
        title: "Produit validé",
        description: "Le produit est maintenant disponible dans le stock",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de valider le produit",
        variant: "destructive",
      });
    },
  });

  // Mutation pour modifier un produit
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; nom: string; stockMinimum: number }) => {
      return apiRequest("PUT", `/api/products/${data.id}`, {
        nom: data.nom,
        stockMinimum: data.stockMinimum,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/pending"] });
      setEditingProduct(null);
      toast({
        title: "Produit modifié",
        description: "Les modifications ont été enregistrées",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le produit",
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un produit
  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("DELETE", `/api/products/${productId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/pending"] });
      toast({
        title: "Produit supprimé",
        description: "Le produit a été retiré de la base de données",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le produit",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (product: ProductWithStock) => {
    setEditingProduct(product);
    setEditNom(product.nom);
    setEditStockMin(product.stockMinimum);
  };

  const handleUpdate = () => {
    if (!editingProduct) return;
    updateMutation.mutate({
      id: editingProduct.id,
      nom: editNom,
      stockMinimum: editStockMin,
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--vert-clair))] pb-24">
      <AppHeader showBack={true} backPath="/" title="Admin" />

      <div className="px-4 py-6 space-y-6">
        {/* Export CSV */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/products/export-csv";
          }}
          data-testid="button-export-csv"
        >
          <Download className="mr-2 h-4 w-4" />
          Exporter tous les produits (CSV)
        </Button>

        {/* Stats */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-[hsl(var(--orange-alerte))]" />
              <div>
                <div className="text-2xl font-bold" data-testid="text-pending-count">
                  {pendingProducts.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Produit{pendingProducts.length > 1 ? "s" : ""} en attente
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des produits en attente */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Produits en attente de validation</h2>
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Chargement...
              </CardContent>
            </Card>
          ) : pendingProducts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucun produit en attente
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingProducts.map((product) => (
                <Card key={product.id} data-testid={`card-pending-${product.id}`}>
                  <CardContent className="py-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{product.nom}</h3>
                          <Badge 
                            className="bg-[hsl(var(--orange-alerte))] text-white"
                            data-testid={`badge-status-${product.id}`}
                          >
                            En attente
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {product.categorie} → {product.sousSection}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Stock initial: {product.stockActuel} {product.unite}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        onClick={() => validateMutation.mutate(product.id)}
                        disabled={validateMutation.isPending}
                        className="bg-[hsl(var(--teal-principal))] hover:bg-[hsl(var(--teal-principal))]/90 text-white border-0"
                        data-testid={`button-validate-${product.id}`}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEdit(product)}
                        className="bg-[hsl(var(--teal-secondaire))] hover:bg-[hsl(var(--teal-secondaire))]/90 text-white border-0"
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="bg-[hsl(var(--rouge-urgent))] hover:bg-[hsl(var(--rouge-urgent))]/90 text-white border-0"
                        data-testid={`button-delete-${product.id}`}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Supprimer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editNom">Nom du produit</Label>
              <Input
                id="editNom"
                value={editNom}
                onChange={(e) => setEditNom(e.target.value)}
                className="min-h-touch"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStockMin">Stock minimum</Label>
              <Input
                id="editStockMin"
                type="number"
                min="0"
                value={editStockMin}
                onChange={(e) => setEditStockMin(parseInt(e.target.value) || 0)}
                className="min-h-touch"
                data-testid="input-edit-min-stock"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingProduct(null)}
              data-testid="button-cancel-edit"
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !editNom}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
