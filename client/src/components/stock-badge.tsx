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
        return "bg-[hsl(142,71%,45%)] text-white border-[hsl(142,71%,35%)]";
      case "faible":
        return "bg-[hsl(25,95%,53%)] text-white border-[hsl(25,95%,43%)]";
      case "vide":
        return "bg-[hsl(0,84%,60%)] text-white border-[hsl(0,84%,50%)]";
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
        return "bg-[hsl(142,71%,45%)]";
      case "faible":
        return "bg-[hsl(25,95%,53%)]";
      case "vide":
        return "bg-[hsl(0,84%,60%)]";
    }
  };

  return (
    <div 
      className={`w-2 h-2 rounded-full ${getColor(status)}`}
      data-testid={`dot-stock-${status}`}
    />
  );
}
