import { Check, ChevronDown, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCurrentUser } from "@/lib/user-context";
import { TEAM_MEMBERS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UserSelectorProps {
  listeCount?: number;
}

export function UserSelector({ listeCount = 0 }: UserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showListeWarning, setShowListeWarning] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { currentUserId, setCurrentUserId, currentUser } = useCurrentUser();
  const { toast } = useToast();

  const handleUserSelect = (memberId: number, role: string) => {
    // Empêcher le changement d'utilisateur si la liste contient des items
    if (currentUserId && listeCount > 0) {
      setPendingUserId(memberId);
      setPendingRole(role);
      setShowListeWarning(true);
      setOpen(false);
      return;
    }

    if (role === "admin") {
      setSelectedAdminId(memberId);
      setPassword("");
      setShowPasswordDialog(true);
      setOpen(false);
    } else {
      setCurrentUserId(memberId);
      setOpen(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAdminId) return;
    
    setIsVerifying(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/verify-admin", {
        userId: selectedAdminId,
        password,
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentUserId(selectedAdminId);
        setShowPasswordDialog(false);
        setPassword("");
        toast({
          title: "Connexion réussie",
          description: `Bienvenue ${data.user.nom}!`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Mot de passe incorrect",
        description: "Veuillez réessayer",
        variant: "destructive",
      });
      setPassword("");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-touch text-base"
            data-testid="button-select-user"
          >
            {currentUser ? (
              <span className="font-medium">{currentUser.nom}</span>
            ) : (
              <span className="text-muted-foreground">Sélectionner un utilisateur</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Rechercher..." data-testid="input-search-user" />
            <CommandList>
              <CommandEmpty>Aucun utilisateur trouvé.</CommandEmpty>
              <CommandGroup>
                {TEAM_MEMBERS.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={member.nom}
                    onSelect={() => handleUserSelect(member.id, member.role)}
                    data-testid={`option-user-${member.id}`}
                    className="min-h-touch cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        currentUserId === member.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{member.nom}</span>
                      {member.role === "admin" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Administrateur
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Authentification admin
            </DialogTitle>
            <DialogDescription>
              Entrez le mot de passe pour accéder aux fonctionnalités d'administration
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isVerifying}
                  data-testid="input-admin-password"
                  autoFocus
                  className="min-h-touch pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isVerifying}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPassword("");
                }}
                disabled={isVerifying}
                data-testid="button-cancel-password"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!password || isVerifying}
                data-testid="button-submit-password"
              >
                {isVerifying ? "Vérification..." : "Se connecter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showListeWarning} onOpenChange={setShowListeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[hsl(25,95%,53%)]" />
              Liste non validée
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez {listeCount} article{listeCount > 1 ? 's' : ''} dans votre liste non validée. 
              Veuillez valider ou vider votre liste avant de changer d'utilisateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-user-change">
              Compris
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
