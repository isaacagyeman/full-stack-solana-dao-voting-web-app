import { useRef, useState } from "react";
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
import {
  ChevronLeft, Plus, Trash2, Users, AlertCircle, Shield, FileUp, X, CheckCircle2,
  Mail, Phone, Building, Briefcase, UserCheck, UserX,
} from "lucide-react";

type Member = {
  id: number;
  userId?: number | null;
  orgId?: number;
  role: string;
  status: string;
  joinedAt: string;
  fullName?: string;
  email?: string;
  phone?: string;
  department?: string | null;
  position?: string | null;
  hasAccount?: boolean;
  // legacy
  name?: string;
};

type ImportedMember = {
  fullName: string;
  email: string;
  phone: string;
  department?: string;
  position?: string;
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

function StatusBadge({ status, hasAccount }: { status: string; hasAccount?: boolean }) {
  if (status === "invited" || !hasAccount) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
        <UserX className="w-3 h-3" /> Pending
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit">
      <UserCheck className="w-3 h-3" /> Active
    </span>
  );
}

export default function Members() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Add single member dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("voter");
  const [addError, setAddError] = useState("");

  // Excel import dialog
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedMember[]>([]);
  const [editedPreview, setEditedPreview] = useState<ImportedMember[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ successfulRows: number; failedRows: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: org } = useGetOrganization(slug);
  const { data: members, isLoading } = useListMembers(slug);
  const myRole = (org as { myRole?: string })?.myRole ?? "observer";
  const isAdmin = myRole === "admin";
  const isAdminOrOfficer = ["admin", "officer"].includes(myRole);

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

  // ─── Excel import handlers ─────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImporting(true);
    setImportErrors([]);
    setImportPreview([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${baseUrl}/api/organizations/${slug}/members/import-preview`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await resp.json() as { records?: ImportedMember[]; errors?: string[] };
      if (!resp.ok) {
        setImportErrors([data.errors?.[0] ?? "Server error"]);
      } else {
        setImportPreview(data.records ?? []);
        setEditedPreview(data.records ?? []);
        setImportErrors(data.errors ?? []);
        if ((data.records ?? []).length > 0) setImportStep("preview");
      }
    } catch {
      setImportErrors(["Failed to connect to server."]);
    } finally {
      setImporting(false);
    }
  }

  function updateEditedRow(i: number, field: keyof ImportedMember, value: string) {
    setEditedPreview((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function removeEditedRow(i: number) {
    setEditedPreview((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function confirmImport() {
    setImporting(true);
    try {
      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${baseUrl}/api/organizations/${slug}/members/import-confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: editedPreview }),
      });
      const data = await resp.json() as { successfulRows?: number; failedRows?: number; error?: string };
      if (!resp.ok) {
        setImportErrors([data.error ?? "Import failed"]);
      } else {
        setImportResult({ successfulRows: data.successfulRows ?? 0, failedRows: data.failedRows ?? 0 });
        setImportStep("done");
        qc.invalidateQueries({ queryKey: getListMembersQueryKey(slug) });
      }
    } catch {
      setImportErrors(["Failed to save members."]);
    } finally {
      setImporting(false);
    }
  }

  function closeImportDialog() {
    setShowImport(false);
    setImportStep("upload");
    setImportFile(null);
    setImportPreview([]);
    setEditedPreview([]);
    setImportErrors([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

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
            {isAdminOrOfficer && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImport(true)}>
                  <FileUp className="w-4 h-4 mr-1.5" />
                  Import Excel
                </Button>
                {isAdmin && (
                  <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add member
                  </Button>
                )}
              </div>
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
              <p className="text-slate-500 mb-4">No members yet</p>
              {isAdminOrOfficer && (
                <Button variant="outline" onClick={() => setShowImport(true)}>
                  <FileUp className="w-4 h-4 mr-1.5" />
                  Import members from Excel
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {memberList.map((member, i) => {
                const displayName = member.fullName ?? member.name ?? "—";
                const displayEmail = member.email ?? "—";
                const initials = displayName !== "—" ? displayName.charAt(0).toUpperCase() : "?";
                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-4 p-4 ${i < memberList.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${member.hasAccount !== false ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900 truncate">{displayName}</p>
                        <RoleBadge role={member.role} />
                        <StatusBadge status={member.status} hasAccount={member.hasAccount} />
                        {member.userId === user?.id && <span className="text-xs text-slate-400">(you)</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {displayEmail !== "—" && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />{displayEmail}
                          </span>
                        )}
                        {member.phone && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />{member.phone}
                          </span>
                        )}
                        {member.department && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Building className="w-3 h-3" />{member.department}
                          </span>
                        )}
                        {member.position && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />{member.position}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && member.userId !== user?.id && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={member.role}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({ slug, userId: member.userId ?? 0, data: { role } })
                          }
                        >
                          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="officer">Officer</SelectItem>
                            <SelectItem value="voter">Voter</SelectItem>
                            <SelectItem value="observer">Observer</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => removeMutation.mutate({ slug, userId: member.userId ?? 0 })}
                          className="text-slate-300 hover:text-red-400 transition-colors p-1"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
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
              <p className="mt-2 text-xs text-blue-500">
                <strong>Pending members</strong> have been invited but haven't linked their account yet. They will receive a voting token by email/SMS when an election is published.
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* ─── Add single member dialog ─── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{addError}
              </div>
            )}
            <div>
              <Label>Email address</Label>
              <Input className="mt-1.5" type="email" placeholder="user@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">The user must have a VoteChain account.</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
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
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!addEmail || addMutation.isPending}
              onClick={() => addMutation.mutate({ slug, data: { email: addEmail, role: addRole } })}>
              {addMutation.isPending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Excel import dialog ─── */}
      <Dialog open={showImport} onOpenChange={closeImportDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              Import members from Excel
            </DialogTitle>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <FileUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 mb-1">Choose your Excel file</p>
                <p className="text-xs text-slate-500 mb-4">
                  Required columns: <strong>Full name</strong>, <strong>Email-address</strong>, <strong>Telephone number</strong><br />
                  Optional: <strong>Department</strong>, <strong>Position</strong>
                </p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                  {importing ? "Parsing…" : "Select .xlsx file"}
                </Button>
              </div>
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-sm text-red-600">{e}</p>
                  ))}
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">Tips for your spreadsheet:</p>
                <ul className="space-y-0.5 list-disc list-inside text-blue-600">
                  <li>Header row must use these exact names (case-insensitive): Full name, Email-address, Telephone number</li>
                  <li>Each member must have a name, email, and phone number</li>
                  <li>Duplicate emails are automatically skipped</li>
                </ul>
              </div>
            </div>
          )}

          {importStep === "preview" && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700">
                  <strong>{editedPreview.length}</strong> members ready to import.
                  Edit or remove rows before confirming.
                </p>
                {importErrors.length > 0 && (
                  <p className="text-xs text-amber-600">{importErrors.length} row{importErrors.length > 1 ? "s" : ""} skipped</p>
                )}
              </div>

              <div className="flex-1 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {["Full name *", "Email *", "Phone *", "Department", "Position", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 border-b border-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editedPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {(["fullName", "email", "phone", "department", "position"] as const).map((field) => (
                          <td key={field} className="px-2 py-1.5">
                            <input
                              className="w-full text-xs px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none bg-transparent focus:bg-white"
                              value={row[field] ?? ""}
                              onChange={(e) => updateEditedRow(i, field, e.target.value)}
                              placeholder={field === "department" || field === "position" ? "optional" : "required"}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => removeEditedRow(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 max-h-24 overflow-y-auto">
                  <p className="font-medium mb-1">Rows skipped:</p>
                  {importErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}

          {importStep === "done" && importResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Import complete</h3>
              <p className="text-slate-500 text-sm">
                <strong>{importResult.successfulRows}</strong> member{importResult.successfulRows !== 1 ? "s" : ""} added successfully.
                {importResult.failedRows > 0 && ` ${importResult.failedRows} row${importResult.failedRows > 1 ? "s" : ""} skipped.`}
              </p>
              <p className="text-xs text-slate-400">
                Voting tokens will be sent to eligible members when you publish an election.
              </p>
            </div>
          )}

          <DialogFooter className="mt-2">
            {importStep === "upload" && (
              <Button variant="outline" onClick={closeImportDialog}>Cancel</Button>
            )}
            {importStep === "preview" && (
              <>
                <Button variant="outline" onClick={() => setImportStep("upload")}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={editedPreview.length === 0 || importing}
                  onClick={confirmImport}
                >
                  {importing ? "Importing…" : `Import ${editedPreview.length} member${editedPreview.length !== 1 ? "s" : ""}`}
                </Button>
              </>
            )}
            {importStep === "done" && (
              <Button onClick={closeImportDialog}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
