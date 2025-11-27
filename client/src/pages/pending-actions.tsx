import { useState, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Clock, AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { actionQueue, type PendingAction } from "@/lib/actionQueue";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PendingActions() {
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  const [pendingItems, setPendingItems] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setPendingItems(actionQueue.getPendingItems());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingItems(actionQueue.getPendingItems());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRemoveItem = (actionId: string) => {
    actionQueue.remove(actionId);
    setPendingItems(actionQueue.getPendingItems());
    toast({
      title: "Action supprimée",
      description: "L'action en attente a été retirée de la queue",
    });
  };

  const handleClearAll = () => {
    actionQueue.clear();
    setPendingItems([]);
    toast({
      title: "Queue vidée",
      description: "Toutes les actions en attente ont été supprimées",
    });
  };

  const handleSyncNow = async () => {
    if (!isOnline) {
      toast({
        title: "Impossible de synchroniser",
        description: "Vous devez être connecté à internet",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await actionQueue.flush();
      setPendingItems(actionQueue.getPendingItems());
      
      queryClient.invalidateQueries({ queryKey: ["/api/liste"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      if (result.success > 0) {
        toast({
          title: "Synchronisation réussie",
          description: `${result.success} action(s) effectuée(s)`,
        });
      }

      if (result.failed > 0) {
        toast({
          title: `${result.failed} action(s) échouée(s)`,
          description: result.errors.map(e => `${e.productNom}: ${e.reason}`).join(", "),
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      toast({
        title: "Erreur de synchronisation",
        description: "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetrySingle = async (actionId: string) => {
    if (!isOnline) {
      toast({
        title: "Impossible de réessayer",
        description: "Vous devez être connecté à internet",
        variant: "destructive",
      });
      return;
    }

    const result = await actionQueue.flushSingle(actionId);
    setPendingItems(actionQueue.getPendingItems());

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["/api/liste"] });
      toast({
        title: "Action synchronisée",
        description: "L'action a été effectuée avec succès",
      });
    } else {
      toast({
        title: "Échec de l'action",
        description: result.reason || "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionLabel = (action: PendingAction) => {
    switch (action.payload.typeAction) {
      case "prendre":
        return "Prendre";
      case "deposer":
        return "Déposer";
      case "rendre":
        return "Rendre";
      default:
        return action.payload.typeAction;
    }
  };

  const pendingCount = pendingItems.filter(p => p.status === "pending").length;
  const failedCount = pendingItems.filter(p => p.status === "failed").length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader showBack={true} backPath="/" title="Actions en attente" />

      <div className="px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="flex gap-4">
          <Card className="flex-1">
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">En attente</div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-destructive">{failedCount}</div>
              <div className="text-sm text-muted-foreground">Échecs</div>
            </CardContent>
          </Card>
        </div>

        {/* Actions globales */}
        <div className="flex gap-3">
          <Button
            onClick={handleSyncNow}
            disabled={!isOnline || pendingItems.length === 0 || isSyncing}
            className="flex-1"
            data-testid="button-sync-now"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Synchronisation..." : "Synchroniser maintenant"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={pendingItems.length === 0}
                data-testid="button-clear-queue"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vider la queue ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera toutes les actions en attente ({pendingItems.length}).
                  Les items ne seront pas ajoutés à votre liste.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>Vider</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Liste des actions */}
        {pendingItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Aucune action en attente</p>
              <Link href="/">
                <Button data-testid="button-home-empty">
                  Retour à l'accueil
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((action) => (
              <Card 
                key={action.id}
                className={action.status === "failed" 
                  ? "border-destructive bg-destructive/5" 
                  : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                }
                data-testid={`card-action-${action.id}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate" data-testid={`text-product-${action.id}`}>
                          {action.payload.productNom}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={action.status === "failed"
                            ? "bg-destructive/10 text-destructive border-destructive/30 text-xs"
                            : "bg-orange-100 text-orange-700 border-orange-300 text-xs"
                          }
                        >
                          {action.status === "failed" ? (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Échec
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              En attente
                            </>
                          )}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getActionLabel(action)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mt-2 space-y-1">
                        <p>Quantité: {action.payload.quantite}</p>
                        {action.payload.longueur && action.payload.largeur && (
                          <p>Dimensions: {action.payload.longueur}m × {action.payload.largeur}m</p>
                        )}
                        <p className="text-xs">Ajouté le {formatDate(action.timestamp)}</p>
                      </div>

                      {action.errorMessage && (
                        <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {action.errorMessage}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {action.status === "failed" && isOnline && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetrySingle(action.id)}
                          data-testid={`button-retry-${action.id}`}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(action.id)}
                        data-testid={`button-remove-${action.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Comment ça fonctionne ?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Les actions sont automatiquement synchronisées à la reconnexion</li>
                  <li>Les actions de plus de 7 jours sont supprimées automatiquement</li>
                  <li>Limite : 50 actions maximum en attente</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
