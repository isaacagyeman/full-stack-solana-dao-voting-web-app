import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetOrganization, useListOrgElections } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Vote,
  Users,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Settings,
  ChevronLeft,
} from "lucide-react";

type Election = {
  id: number;
  title: string;
  description?: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    active: { label: "Active", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
    draft: { label: "Draft", className: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
    closed: { label: "Closed", className: "bg-slate-100 text-slate-600 border-slate-200", icon: XCircle },
  };
  const cfg = map[status] ?? map.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeLeft(end: string) {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export default function OrgDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: org, isLoading: orgLoading } = useGetOrganization(slug);
  const { data: electionList, isLoading: electionsLoading } = useListOrgElections(slug, {});

  const myRole = (org as { myRole?: string })?.myRole ?? "voter";
  const isAdmin = myRole === "admin";
  const isOfficer = ["admin", "officer"].includes(myRole);

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-64" />
            <div className="h-4 bg-slate-200 rounded w-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-10 text-center">
          <h2 className="text-xl font-bold text-slate-800">Organization not found</h2>
          <Link href="/dashboard">
            <Button className="mt-4">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const elections = (electionList ?? []) as Election[];
  const activeElections = elections.filter((e) => e.status === "active");
  const draftElections = elections.filter((e) => e.status === "draft");
  const closedElections = elections.filter((e) => e.status === "closed");

  function ElectionCard({ election }: { election: Election }) {
    return (
      <Link href={`/orgs/${slug}/elections/${election.id}`}>
        <div className="bg-white rounded-xl border border-slate-100 p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={election.status} />
                <span className="text-xs text-slate-400 capitalize">{election.type}</span>
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                {election.title}
              </h3>
              {election.description && (
                <p className="text-slate-500 text-sm mt-1 line-clamp-1">{election.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {election.status === "active" ? timeLeft(election.endTime) : `Ended ${formatDate(election.endTime)}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {election.status === "closed" && (
                <Link href={`/orgs/${slug}/elections/${election.id}/results`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BarChart3 className="w-3.5 h-3.5 mr-1" />
                    Results
                  </Button>
                </Link>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/dashboard">
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              Back to dashboard
            </button>
          </Link>

          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
                {org.description && <p className="text-slate-500 mt-1 text-sm">{org.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {(org as { memberCount?: number }).memberCount ?? 0} members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Vote className="w-4 h-4" />
                    {(org as { electionCount?: number }).electionCount ?? 0} elections
                  </span>
                  <span className="capitalize bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                    {myRole}
                  </span>
                </div>
                {isAdmin && (org as { accessCode?: string }).accessCode && (
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="text-slate-500">Voting reference:</span>
                    <span className="font-mono font-semibold tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                      {(org as { accessCode?: string }).accessCode}
                    </span>
                    <span className="text-xs text-slate-400">Share this with voters to let them join</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {isAdmin && (
                <Link href={`/orgs/${slug}/members`}>
                  <Button variant="outline" size="sm">
                    <Users className="w-4 h-4 mr-1.5" />
                    Members
                  </Button>
                </Link>
              )}
              {isOfficer && (
                <Link href={`/orgs/${slug}/create-election`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New election
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {electionsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-32 mb-3" />
                  <div className="h-5 bg-slate-100 rounded w-64" />
                </div>
              ))}
            </div>
          ) : elections.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <Vote className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 mb-2">No elections yet</h3>
              <p className="text-slate-500 text-sm mb-4">
                {isOfficer ? "Create your first election to get started." : "No elections have been created yet."}
              </p>
              {isOfficer && (
                <Link href={`/orgs/${slug}/create-election`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create election
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {activeElections.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Active elections</h2>
                  <div className="space-y-3">
                    {activeElections.map((e) => <ElectionCard key={e.id} election={e} />)}
                  </div>
                </div>
              )}
              {draftElections.length > 0 && isOfficer && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Drafts</h2>
                  <div className="space-y-3">
                    {draftElections.map((e) => <ElectionCard key={e.id} election={e} />)}
                  </div>
                </div>
              )}
              {closedElections.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Past elections</h2>
                  <div className="space-y-3">
                    {closedElections.map((e) => <ElectionCard key={e.id} election={e} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
