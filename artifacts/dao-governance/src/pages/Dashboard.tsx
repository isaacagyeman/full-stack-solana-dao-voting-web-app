import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useListOrganizations,
  useCreateOrganization,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrganizationsQueryKey, useJoinOrganizationByCode } from "@workspace/api-client-react";
import {
  Building2,
  Plus,
  Users,
  Vote,
  ChevronRight,
  LayoutGrid,
  AlertCircle,
  KeyRound,
} from "lucide-react";

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700 border-purple-200",
    officer: "bg-blue-100 text-blue-700 border-blue-200",
    voter: "bg-green-100 text-green-700 border-green-200",
    observer: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors[role] ?? colors.observer}`}>
      {role}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgDesc, setOrgDesc] = useState("");
  const [createError, setCreateError] = useState("");

  const [showJoin, setShowJoin] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [joinError, setJoinError] = useState("");

  const isOrganizer = user?.role === "organizer";

  const { data: orgs, isLoading } = useListOrganizations();

  const createMutation = useCreateOrganization({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setShowCreate(false);
        setOrgName("");
        setOrgDesc("");
      },
      onError(err: unknown) {
        setCreateError((err as { data?: { error?: string } })?.data?.error ?? "Failed to create");
      },
    },
  });

  const joinMutation = useJoinOrganizationByCode({
    mutation: {
      onSuccess(data) {
        qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setShowJoin(false);
        setAccessCode("");
        setJoinError("");
        navigate(`/orgs/${(data as { slug: string }).slug}`);
      },
      onError(err: unknown) {
        setJoinError((err as { data?: { error?: string } })?.data?.error ?? "Invalid voting reference");
      },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome back, {user?.name?.split(" ")[0]}
              </h1>
              <p className="text-slate-500 mt-1">Manage your organizations and elections</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowJoin(true)}
              >
                <KeyRound className="w-4 h-4 mr-1.5" />
                Join with voting reference
              </Button>
              {isOrganizer && (
                <Button
                  onClick={() => setShowCreate(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  New organization
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                  <div className="h-5 bg-slate-100 rounded w-48 mb-3" />
                  <div className="h-4 bg-slate-100 rounded w-72" />
                </div>
              ))}
            </div>
          ) : orgs && orgs.length > 0 ? (
            <div className="grid gap-4">
              {orgs.map((org, i) => (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link href={`/orgs/${org.slug}`}>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="font-semibold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                                {org.name}
                              </h2>
                              <RoleBadge role={(org as { myRole?: string }).myRole ?? "voter"} />
                            </div>
                            {org.description && (
                              <p className="text-slate-500 text-sm line-clamp-1">{org.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-4 h-4" />
                                {(org as { memberCount?: number }).memberCount ?? 0} members
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Vote className="w-4 h-4" />
                                {(org as { electionCount?: number }).electionCount ?? 0} elections
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors mt-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <LayoutGrid className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No organizations yet</h3>
              <p className="text-slate-500 mb-6 max-w-xs mx-auto">
                {isOrganizer
                  ? "Create your first organization to start running elections."
                  : "Ask your election organizer for a voting reference to join an organization."}
              </p>
              {isOrganizer ? (
                <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create organization
                </Button>
              ) : (
                <Button onClick={() => setShowJoin(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <KeyRound className="w-4 h-4 mr-1.5" />
                  Join with voting reference
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {createError}
              </div>
            )}
            <div>
              <Label>Organization name</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Springfield School District"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                className="mt-1.5"
                placeholder="Brief description of your organization"
                value={orgDesc}
                onChange={(e) => setOrgDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!orgName.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ data: { name: orgName, description: orgDesc, isPublic: true } })
              }
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join with voting reference</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {joinError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {joinError}
              </div>
            )}
            <div>
              <Label>Voting reference / access code</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. SPRING01"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-slate-400 mt-1">Ask your election organizer for this code.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoin(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!accessCode.trim() || joinMutation.isPending}
              onClick={() => joinMutation.mutate({ data: { accessCode: accessCode.trim() } })}
            >
              {joinMutation.isPending ? "Joining…" : "Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
