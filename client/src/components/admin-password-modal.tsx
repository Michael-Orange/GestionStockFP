import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  onSuccess: () => void;
}

export function AdminPasswordModal({
  isOpen,
  onClose,
  onVerify,
  onSuccess,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError("Veuillez entrer le mot de passe");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await onVerify(password);
      
      if (success) {
        setPassword("");
        setError(null);
        onSuccess();
        onClose();
      } else {
        setError("Mot de passe incorrect");
      }
    } catch (err) {
      setError("Erreur de vérification");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Vérification admin requise
          </DialogTitle>
          <DialogDescription>
            Entrez le mot de passe administrateur pour effectuer cette action.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Mot de passe</Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="Mot de passe admin"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="min-h-[48px]"
              autoFocus
              disabled={isLoading}
              data-testid="input-admin-password"
            />
            {error && (
              <p className="text-sm text-destructive" data-testid="text-password-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="min-h-[48px]"
              data-testid="button-cancel-admin"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="min-h-[48px]"
              data-testid="button-verify-admin"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Valider"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
