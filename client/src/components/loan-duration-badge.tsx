import { Badge } from "@/components/ui/badge";
import type { ActiveLoan } from "@/lib/types";

interface LoanDurationBadgeProps {
  loan: ActiveLoan;
}

export function LoanDurationBadge({ loan }: LoanDurationBadgeProps) {
  const getDurationStyle = (status: ActiveLoan["statusDuree"]) => {
    switch (status) {
      case "recent":
        return "bg-[hsl(142,71%,45%)] text-white border-[hsl(142,71%,35%)]";
      case "attention":
        return "bg-[hsl(25,95%,53%)] text-white border-[hsl(25,95%,43%)]";
      case "retard":
        return "bg-[hsl(0,84%,60%)] text-white border-[hsl(0,84%,50%)]";
    }
  };

  const getDurationText = () => {
    const jours = loan.dureeJours;
    if (jours === 0) return "Aujourd'hui";
    if (jours === 1) return "Depuis 1 jour";
    return `Depuis ${jours} jours`;
  };

  return (
    <Badge 
      className={`${getDurationStyle(loan.statusDuree)} font-medium border text-xs`}
      data-testid={`badge-duration-${loan.statusDuree}`}
    >
      {getDurationText()}
    </Badge>
  );
}
