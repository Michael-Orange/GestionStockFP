import { Badge } from "@/components/ui/badge";
import type { ProductWithStock } from "@/lib/types";

interface StockBadgeProps {
  product: ProductWithStock;
  showQuantity?: boolean;
}

export function StockBadge({ product, showQuantity = true }: StockBadgeProps) {
  const getStockStyle = (status: ProductWithStock["stockStatus"]) => {
    switch (status) {
      case "ok":
        return "bg-[hsl(var(--stock-ok))] text-white border-[hsl(var(--stock-ok))]";
      case "faible":
        return "bg-[hsl(var(--stock-low))] text-white border-[hsl(var(--stock-low))]";
      case "vide":
        return "bg-[hsl(var(--stock-empty))] text-white border-[hsl(var(--stock-empty))]";
    }
  };

  const getStockText = (status: ProductWithStock["stockStatus"]) => {
    if (!showQuantity) {
      switch (status) {
        case "ok":
          return "Stock OK";
        case "faible":
          return "Stock faible";
        case "vide":
          return "Rupture";
      }
    }

    switch (status) {
      case "ok":
        return `${product.stockDisponible} disponible${product.stockDisponible > 1 ? "s" : ""}`;
      case "faible":
        return `Stock faible (${product.stockDisponible})`;
      case "vide":
        return "Rupture";
    }
  };

  return (
    <Badge 
      className={`${getStockStyle(product.stockStatus)} font-medium border`}
      data-testid={`badge-stock-${product.stockStatus}`}
    >
      {getStockText(product.stockStatus)}
    </Badge>
  );
}

interface StockIndicatorDotProps {
  status: ProductWithStock["stockStatus"];
}

export function StockIndicatorDot({ status }: StockIndicatorDotProps) {
  const getColor = (status: ProductWithStock["stockStatus"]) => {
    switch (status) {
      case "ok":
        return "bg-[hsl(var(--stock-ok))]";
      case "faible":
        return "bg-[hsl(var(--stock-low))]";
      case "vide":
        return "bg-[hsl(var(--stock-empty))]";
    }
  };

  return (
    <div 
      className={`w-3 h-3 rounded-full ${getColor(status)}`}
      data-testid={`dot-stock-${status}`}
    />
  );
}
