import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useCreateElection, useGetOrganization } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CandidateImageUpload,
  CsvImportPanel,
  NotificationPreferencesPanel,
  VoterTokenDisplay,
  type CsvImportRow,
} from "@/components/features/feature-components";
import { Plus, Trash2, ChevronLeft, AlertCircle } from "lucide-react";

type CandidateInput = { name: string; description: string; imageUrl?: string };

function formatDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateElection() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: org } = useGetOrganization(slug);

  useEffect(() => {
    if (user && user.role !== "organizer") {
      navigate(`/orgs/${slug}`);
    }
  }, [user, slug, navigate]);

  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("single");
  const [startTime, setStartTime] = useState(formatDatetimeLocal(start));
  const [endTime, setEndTime] = useState(formatDatetimeLocal(end));
  const [candidateList, setCandidates] = useState<CandidateInput[]>([
    { name: "", description: "", imageUrl: "" },
    { name: "", description: "", imageUrl: "" },
  ]);
  const [csvValue, setCsvValue] = useState("");
  const [tokenPreview, setTokenPreview] = useState("VTR-2024-ALPHA-001");
  const [error, setError] = useState("");

  const createMutation = useCreateElection({
    mutation: {
      onSuccess(data) {
        navigate(`/orgs/${slug}/elections/${(data as { id: number }).id}`);
      },
      onError(err: unknown) {
        setError((err as { data?: { error?: string } })?.data?.error ?? "Failed to create election");
      },
    },
  });

  function addCandidate() {
    setCandidates((prev) => [...prev, { name: "", description: "", imageUrl: "" }]);
  }

  function removeCandidate(i: number) {
    setCandidates((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCandidate(i: number, field: keyof CandidateInput, value: string) {
    setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function handleImportRows(rows: CsvImportRow[]) {
    const imported = rows.map((row) => ({ name: row.name, description: row.description, imageUrl: "" }));
    setCandidates((prev) => {
      const merged = [...prev];
      imported.forEach((candidate) => merged.push(candidate));
      return merged.filter((candidate, index) => candidate.name || index < 2);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validCandidates = candidateList.filter((c) => c.name.trim());
    if (validCandidates.length < 2) {
      setError("Please add at least 2 candidates");
      return;
    }
    if (!org) return;
    createMutation.mutate({
      data: {
        orgId: (org as { id: number }).id,
        title,
        description,
        type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        candidateList: validCandidates.map((c) => ({ name: c.name, description: c.description || undefined, imageUrl: c.imageUrl || undefined })),
      } as never,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link href={`/orgs/${slug}`}>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              {(org as { name?: string })?.name ?? "Back"}
            </button>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Create election</h1>
            <p className="text-slate-500 mt-1">Set up a new election for {(org as { name?: string })?.name}</p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
              <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Election details</h2>
              <div>
                <Label className="text-slate-700 font-medium">Title</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. Board Director Election 2024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-slate-700 font-medium">Description (optional)</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Provide context for voters"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-slate-700 font-medium">Election type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single choice — voters pick one option</SelectItem>
                    <SelectItem value="yesno">Yes / No — simple approval vote</SelectItem>
                    <SelectItem value="multi">Multi-choice — voters pick multiple options</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">Start time</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1.5"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">End time</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1.5"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Candidates / options</h2>
                <Button type="button" variant="outline" size="sm" onClick={addCandidate}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-4">
                {candidateList.map((c, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder={`Option ${i + 1} name *`}
                        value={c.name}
                        onChange={(e) => updateCandidate(i, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Brief description (optional)"
                        value={c.description}
                        onChange={(e) => updateCandidate(i, "description", e.target.value)}
                      />
                      <CandidateImageUpload
                        value={c.imageUrl ?? ""}
                        onChange={(value) => updateCandidate(i, "imageUrl", value)}
                        label={`Photo for ${c.name || `candidate ${i + 1}`}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCandidate(i)}
                      disabled={candidateList.length <= 2}
                      className="mt-1 text-slate-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <CsvImportPanel value={csvValue} onChange={setCsvValue} onImport={handleImportRows} />
              </div>
              <p className="text-xs text-slate-400 mt-3">Minimum 2 options required. The election will be saved as a draft — you can publish it when ready.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
              <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Advanced setup</h2>
              <NotificationPreferencesPanel />
              <VoterTokenDisplay token={tokenPreview} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Label className="text-slate-700 font-medium">Eligibility groups</Label>
                <Textarea
                  className="mt-2"
                  rows={3}
                  placeholder="Add role-based eligibility groups like finance-team, committee, all-members"
                />
                <p className="mt-2 text-xs text-slate-400">This view previews the new group-based voter gating flow.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(`/orgs/${slug}`)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!title || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create election"}
              </Button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
