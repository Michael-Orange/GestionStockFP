import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg transition-all duration-300"
      data-testid="banner-offline"
    >
      <WifiOff className="h-4 w-4" />
      <span>Hors ligne - Consultation depuis le cache</span>
    </div>
  );
}
