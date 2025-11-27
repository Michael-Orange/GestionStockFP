import { apiRequest } from "./queryClient";

const STORAGE_KEY = "FILTREPLANTE_PENDING_LISTE_ITEMS";
const MAX_QUEUE_SIZE = 50;
const MAX_AGE_DAYS = 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export interface PendingAction {
  id: string;
  type: "add_to_liste";
  payload: {
    productId: number;
    productNom: string;
    quantite: number;
    typeAction: "prendre" | "deposer" | "rendre";
    notes?: string;
    longueur?: number;
    largeur?: number;
  };
  userId: number;
  timestamp: number;
  status: "pending" | "failed";
  errorMessage?: string;
}

export interface FlushResult {
  success: number;
  failed: number;
  errors: Array<{ productNom: string; reason: string }>;
}

interface ProcessResult {
  success: boolean;
  reason?: string;
  skip?: boolean;
}

class ActionQueueService {
  private queue: PendingAction[] = [];

  constructor() {
    this.loadFromStorage();
    this.cleanOldActions();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data)) {
          this.queue = data;
        }
      }
    } catch (e) {
      console.error("[ActionQueue] Erreur chargement localStorage:", e);
      this.queue = [];
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error("[ActionQueue] Erreur sauvegarde localStorage:", e);
    }
  }

  private cleanOldActions(): void {
    const now = Date.now();
    const initialCount = this.queue.length;
    this.queue = this.queue.filter((action) => now - action.timestamp < MAX_AGE_MS);
    if (this.queue.length < initialCount) {
      console.log(`[ActionQueue] ${initialCount - this.queue.length} actions anciennes supprimées`);
      this.saveToStorage();
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  add(
    payload: PendingAction["payload"],
    userId: number
  ): { success: boolean; error?: string } {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      return {
        success: false,
        error: `Limite atteinte (${MAX_QUEUE_SIZE} items max). Synchronisez d'abord.`,
      };
    }

    const action: PendingAction = {
      id: this.generateId(),
      type: "add_to_liste",
      payload,
      userId,
      timestamp: Date.now(),
      status: "pending",
    };

    this.queue.push(action);
    this.saveToStorage();
    console.log(`[ActionQueue] Action ajoutée: ${payload.productNom}`);
    return { success: true };
  }

  remove(actionId: string): void {
    this.queue = this.queue.filter((a) => a.id !== actionId);
    this.saveToStorage();
  }

  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  getCount(): number {
    return this.queue.length;
  }

  getPendingCount(): number {
    return this.queue.filter((a) => a.status === "pending").length;
  }

  getFailedCount(): number {
    return this.queue.filter((a) => a.status === "failed").length;
  }

  getPendingItems(): PendingAction[] {
    return [...this.queue];
  }

  getPendingItemsForUser(userId: number): PendingAction[] {
    return this.queue.filter((a) => a.userId === userId);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async processAction(action: PendingAction): Promise<ProcessResult> {
    try {
      await apiRequest("POST", "/api/liste/add", {
        userId: action.userId,
        item: {
          typeAction: action.payload.typeAction,
          produitId: action.payload.productId,
          quantite: action.payload.quantite,
          longueur: action.payload.longueur,
          largeur: action.payload.largeur,
        },
      });
      return { success: true };
    } catch (error) {
      const err = error as Error;
      const message = err.message || "";

      if (
        message.includes("non trouvé") ||
        message.includes("inactif") ||
        message.includes("404")
      ) {
        return {
          success: false,
          reason: "Produit non disponible",
          skip: true,
        };
      }

      if (message.includes("stock insuffisant") || message.includes("Stock insuffisant")) {
        return {
          success: false,
          reason: "Stock insuffisant",
          skip: true,
        };
      }

      if (message.includes("400")) {
        return {
          success: false,
          reason: "Données invalides",
          skip: true,
        };
      }

      if (message.includes("500") || message.includes("502") || message.includes("503")) {
        throw error;
      }

      return {
        success: false,
        reason: message || "Erreur inconnue",
        skip: true,
      };
    }
  }

  async flush(onProgress?: (current: number, total: number) => void): Promise<FlushResult> {
    const result: FlushResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const pendingActions = this.queue.filter((a) => a.status === "pending");
    const total = pendingActions.length;

    if (total === 0) {
      return result;
    }

    console.log(`[ActionQueue] Début flush: ${total} actions`);

    for (let i = 0; i < pendingActions.length; i++) {
      const action = pendingActions[i];
      onProgress?.(i + 1, total);

      let processResult: ProcessResult | null = null;
      let retries = 0;
      const maxRetries = 2;
      const retryDelays = [1000, 2000];

      while (retries <= maxRetries) {
        try {
          processResult = await this.processAction(action);
          break;
        } catch (error) {
          retries++;
          if (retries <= maxRetries) {
            console.log(
              `[ActionQueue] Retry ${retries}/${maxRetries} pour ${action.payload.productNom}`
            );
            await this.delay(retryDelays[retries - 1]);
          } else {
            processResult = {
              success: false,
              reason: "Serveur indisponible après plusieurs tentatives",
              skip: false,
            };
          }
        }
      }

      if (processResult?.success) {
        result.success++;
        this.remove(action.id);
      } else {
        result.failed++;
        result.errors.push({
          productNom: action.payload.productNom,
          reason: processResult?.reason || "Erreur inconnue",
        });

        const actionIndex = this.queue.findIndex((a) => a.id === action.id);
        if (actionIndex !== -1) {
          this.queue[actionIndex].status = "failed";
          this.queue[actionIndex].errorMessage = processResult?.reason;
        }
      }
    }

    this.saveToStorage();
    console.log(
      `[ActionQueue] Flush terminé: ${result.success} succès, ${result.failed} échecs`
    );

    return result;
  }

  async flushSingle(actionId: string): Promise<ProcessResult> {
    const action = this.queue.find((a) => a.id === actionId);
    if (!action) {
      return { success: false, reason: "Action non trouvée", skip: true };
    }

    try {
      const result = await this.processAction(action);
      if (result.success) {
        this.remove(actionId);
      } else {
        const idx = this.queue.findIndex((a) => a.id === actionId);
        if (idx !== -1) {
          this.queue[idx].status = "failed";
          this.queue[idx].errorMessage = result.reason;
          this.saveToStorage();
        }
      }
      return result;
    } catch (error) {
      return { success: false, reason: "Erreur serveur", skip: false };
    }
  }
}

export const actionQueue = new ActionQueueService();
