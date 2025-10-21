import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUnite(unite: string): string {
  const uniteMap: Record<string, string> = {
    'u': 'unité(s)',
    'm': 'mètre(s)',
  };
  return uniteMap[unite] || unite;
}
