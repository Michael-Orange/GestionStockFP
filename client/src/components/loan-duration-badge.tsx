import { Badge } from "@/components/ui/badge";
import type { ActiveLoan } from "@/lib/types";

interface LoanDurationBadgeProps {
  loan: ActiveLoan;
}

export function LoanDurationBadge({ loan }: LoanDurationBadgeProps) {
  const getDurationStyle = (status: ActiveLoan["statusDuree"]) => {
    switch (status) {
      case "recent":
        return "bg-[hsl(var(--vert-principal))] text-white border-[hsl(var(--vert-principal))]";
      case "attention":
        return "bg-[hsl(var(--orange-alerte))] text-white border-[hsl(var(--orange-alerte))]";
      case "retard":
        return "bg-[hsl(var(--rouge-urgent))] text-white border-[hsl(var(--rouge-urgent))]";
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
