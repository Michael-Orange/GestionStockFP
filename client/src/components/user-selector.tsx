import { Check, ChevronDown } from "lucide-react";
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
import { useState } from "react";
import { useCurrentUser } from "@/lib/user-context";
import { TEAM_MEMBERS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UserSelector() {
  const [open, setOpen] = useState(false);
  const { currentUserId, setCurrentUserId, currentUser } = useCurrentUser();

  return (
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
                  onSelect={() => {
                    setCurrentUserId(member.id);
                    setOpen(false);
                  }}
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
                      <span className="text-xs text-muted-foreground">Administrateur</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
