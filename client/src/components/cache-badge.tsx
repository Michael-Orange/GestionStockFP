import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface CacheBadgeProps {
  className?: string;
}

export function CacheBadge({ className }: CacheBadgeProps) {
  const { isOnline, lastOnlineAt } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  const syncText = lastOnlineAt 
    ? `Dernière sync : ${formatDistanceToNow(lastOnlineAt, { addSuffix: true, locale: fr })}`
    : "Données en cache";

  return (
    <Badge 
      variant="outline" 
      className={`bg-orange-100 text-orange-700 border-orange-300 gap-1.5 ${className || ''}`}
      data-testid="badge-cache"
    >
      <Database className="h-3 w-3" />
      <span>{syncText}</span>
    </Badge>
  );
}
