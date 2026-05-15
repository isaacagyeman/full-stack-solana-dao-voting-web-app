import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import OrgDashboard from "@/pages/OrgDashboard";
import ElectionDetail from "@/pages/ElectionDetail";
import Results from "@/pages/Results";
import CreateElection from "@/pages/CreateElection";
import Members from "@/pages/Members";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();
  return (
    <Switch>
      <Route path="/" component={() => (user ? <Redirect to="/dashboard" /> : <Landing />)} />
      <Route path="/login" component={() => (user ? <Redirect to="/dashboard" /> : <Login />)} />
      <Route path="/signup" component={() => (user ? <Redirect to="/dashboard" /> : <Signup />)} />
      <Route path="/dashboard" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/orgs/:slug/create-election" component={() => <ProtectedRoute><CreateElection /></ProtectedRoute>} />
      <Route path="/orgs/:slug/members" component={() => <ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/orgs/:slug/elections/:id/results" component={() => <ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/orgs/:slug/elections/:id" component={() => <ProtectedRoute><ElectionDetail /></ProtectedRoute>} />
      <Route path="/orgs/:slug" component={() => <ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
