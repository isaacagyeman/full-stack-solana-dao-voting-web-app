import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  useListMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
  useGetOrganization,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getListMembersQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, Plus, Trash2, Users, AlertCircle, Shield } from "lucide-react";

type Member = {
  id: number;
  userId: number;
  orgId: number;
  role: string;
  joinedAt: string;
  name?: string;
  email?: string;
};

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    officer: "bg-blue-100 text-blue-700",
    voter: "bg-green-100 text-green-700",
    observer: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role] ?? colors.observer}`}>
      {role}
    </span>
  );
}

export default function Members() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("voter");
  const [addError, setAddError] = useState("");

  const { data: org } = useGetOrganization(slug);
  const { data: members, isLoading } = useListMembers(slug);
  const myRole = (org as { myRole?: string })?.myRole ?? "observer";
  const isAdmin = myRole === "admin";

  const addMutation = useAddMember({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(slug) });
        setShowAdd(false);
        setAddEmail("");
        setAddError("");
      },
      onError(err: unknown) {
        setAddError((err as { data?: { error?: string } })?.data?.error ?? "Failed to add member");
      },
    },
  });

  const updateRoleMutation = useUpdateMemberRole({
    mutation: {
      onSuccess() { qc.invalidateQueries({ queryKey: getListMembersQueryKey(slug) }); },
    },
  });

  const removeMutation = useRemoveMember({
    mutation: {
      onSuccess() { qc.invalidateQueries({ queryKey: getListMembersQueryKey(slug) }); },
    },
  });

  const memberList = (members ?? []) as Member[];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link href={`/orgs/${slug}`}>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              {(org as { name?: string })?.name ?? "Back"}
            </button>
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Members</h1>
              <p className="text-slate-500 mt-1">{memberList.length} member{memberList.length !== 1 ? "s" : ""}</p>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setShowAdd(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add member
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-32" />
                    <div className="h-3 bg-slate-100 rounded w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : memberList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No members yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {memberList.map((member, i) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-4 p-4 ${i < memberList.length - 1 ? "border-b border-slate-50" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-blue-700">
                    {member.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{member.name ?? "Unknown"}</p>
                      <RoleBadge role={member.role} />
                      {member.userId === user?.id && (
                        <span className="text-xs text-slate-400">(you)</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{member.email}</p>
                  </div>
                  {isAdmin && member.userId !== user?.id && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateRoleMutation.mutate({
                            slug,
                            userId: member.userId,
                            data: { role },
                          })
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="officer">Officer</SelectItem>
                          <SelectItem value="voter">Voter</SelectItem>
                          <SelectItem value="observer">Observer</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => removeMutation.mutate({ slug, userId: member.userId })}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Role permissions</p>
              <ul className="space-y-0.5 text-blue-600 text-xs">
                <li><strong>Admin</strong> — full control, manage members, close elections</li>
                <li><strong>Officer</strong> — create and manage elections</li>
                <li><strong>Voter</strong> — participate in elections</li>
                <li><strong>Observer</strong> — view-only access</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </main>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {addError}
              </div>
            )}
            <div>
              <Label>Email address</Label>
              <Input
                className="mt-1.5"
                type="email"
                placeholder="user@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">The user must have a VoteChain account.</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voter">Voter</SelectItem>
                  <SelectItem value="officer">Officer</SelectItem>
                  <SelectItem value="observer">Observer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!addEmail || addMutation.isPending}
              onClick={() =>
                addMutation.mutate({ slug, data: { email: addEmail, role: addRole } })
              }
            >
              {addMutation.isPending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
