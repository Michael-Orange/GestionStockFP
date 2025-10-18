import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/lib/user-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Prendre from "@/pages/prendre";
import Rendre from "@/pages/rendre";
import Deposer from "@/pages/deposer";
import Stock from "@/pages/stock";
import Admin from "@/pages/admin";
import Panier from "@/pages/panier";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/prendre" component={Prendre} />
      <Route path="/rendre" component={Rendre} />
      <Route path="/deposer" component={Deposer} />
      <Route path="/stock" component={Stock} />
      <Route path="/admin" component={Admin} />
      <Route path="/panier" component={Panier} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <Toaster />
          <Router />
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
