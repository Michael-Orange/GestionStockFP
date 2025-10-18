import { useCurrentUser } from "@/lib/user-context";
import { UserSelector } from "@/components/user-selector";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowDownToLine, ClipboardList } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { currentUser } = useCurrentUser();

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">FiltrePlante</CardTitle>
            <p className="text-center text-muted-foreground">Gestion de Stock</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Sélectionnez votre nom pour commencer
            </p>
            <UserSelector />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      
      {/* User Selector */}
      <div className="px-4 py-4 border-b bg-card">
        <UserSelector />
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/prendre">
              <Button className="w-full h-24 flex-col gap-2" size="lg" data-testid="button-prendre">
                <ArrowDownToLine className="h-6 w-6" />
                <span className="text-base font-medium">PRENDRE</span>
              </Button>
            </Link>
            <Link href="/deposer">
              <Button className="w-full h-24 flex-col gap-2" size="lg" variant="outline" data-testid="button-deposer">
                <Package className="h-6 w-6" />
                <span className="text-base font-medium">DÉPOSER</span>
              </Button>
            </Link>
          </div>
          <Link href="/stock">
            <Button className="w-full h-24 flex-col gap-2" size="lg" variant="outline" data-testid="button-stock">
              <ClipboardList className="h-6 w-6" />
              <span className="text-base font-medium">STOCK</span>
            </Button>
          </Link>
        </div>

        {/* Admin Link */}
        {currentUser.role === "admin" && (
          <Link href="/admin">
            <Button variant="secondary" className="w-full min-h-touch" data-testid="button-admin">
              Interface Administrateur
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
