import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SolanaWalletProvider } from "@/lib/wallet";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import DaoList from "@/pages/DaoList";
import DaoDetail from "@/pages/DaoDetail";
import CreateProposal from "@/pages/CreateProposal";
import ProposalList from "@/pages/ProposalList";
import ProposalDetail from "@/pages/ProposalDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/daos" component={DaoList} />
      <Route path="/daos/:id/create-proposal" component={CreateProposal} />
      <Route path="/daos/:id" component={DaoDetail} />
      <Route path="/proposals" component={ProposalList} />
      <Route path="/proposals/:id" component={ProposalDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </SolanaWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
