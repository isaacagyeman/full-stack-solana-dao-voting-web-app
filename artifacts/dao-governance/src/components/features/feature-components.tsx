import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BellRing,
  CheckCircle2,
  Copy,
  FileUp,
  ImagePlus,
  KeyRound,
  Sparkles,
} from "lucide-react";

export type CsvImportRow = { name: string; description: string };

interface CsvImportPanelProps {
  value: string;
  onChange: (value: string) => void;
  onImport: (rows: CsvImportRow[]) => void;
  className?: string;
}

export function CsvImportPanel({ value, onChange, onImport, className }: CsvImportPanelProps) {
  const [message, setMessage] = useState("");

  function handleImport() {
    const rows = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1)
      .map((line) => line.split(","))
      .filter((cells) => cells[0]?.trim())
      .map((cells) => ({ name: cells[0]?.trim() ?? "", description: cells[1]?.trim() ?? "" }));

    if (rows.length === 0) {
      setMessage("Paste at least one row with name,description.");
      return;
    }

    onImport(rows);
    setMessage(`Imported ${rows.length} candidate${rows.length > 1 ? "s" : ""}.`);
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-4 w-4" />
          Bulk candidate import
        </CardTitle>
        <CardDescription>
          Paste a simple CSV with a header row and each line as name,description.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="name,description\nAda Lovelace,Lead engineer\nGrace Hopper,Research pioneer"
          rows={6}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{message || "This is a lightweight uploader for the create-election flow."}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleImport}>
            Import rows
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CandidateImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
}

export function CandidateImageUpload({ value, onChange, label = "Candidate image" }: CandidateImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setPreview(result);
      onChange(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="mr-1 h-4 w-4" />
          Upload
        </Button>
      </div>
      <Input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <Input
        placeholder="Or paste an image URL"
        value={value ?? ""}
        onChange={(e) => {
          setPreview(e.target.value);
          onChange(e.target.value);
        }}
      />
      {preview && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <img src={preview} alt="Preview" className="h-20 w-full object-cover" />
        </div>
      )}
    </div>
  );
}

export interface PollSlideOption {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface PollSlide {
  id: number;
  title: string;
  description: string;
  options: PollSlideOption[];
}

interface MultiPollVotingFlowProps {
  polls: PollSlide[];
  currentPollIndex: number;
  selections: Record<number, number>;
  onSelect: (pollId: number, optionId: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReview: () => void;
  isSubmitting?: boolean;
}

export function MultiPollVotingFlow({
  polls,
  currentPollIndex,
  selections,
  onSelect,
  onNext,
  onPrevious,
  onReview,
  isSubmitting = false,
}: MultiPollVotingFlowProps) {
  const currentPoll = polls[currentPollIndex];
  if (!currentPoll) return null;

  const selectedOptionId = selections[currentPoll.id];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          <Sparkles className="h-3.5 w-3.5" />
          Slide {currentPollIndex + 1} of {polls.length}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{currentPoll.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{currentPoll.description}</p>
      </div>

      <div className="space-y-3">
        {currentPoll.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(currentPoll.id, option.id)}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{option.name}</p>
                  {option.description && <p className="mt-1 text-sm text-slate-500">{option.description}</p>}
                </div>
                {isSelected && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onPrevious} disabled={currentPollIndex === 0}>
          Previous
        </Button>
        {currentPollIndex < polls.length - 1 ? (
          <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={onNext}>
            Next slide
          </Button>
        ) : (
          <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={onReview} disabled={isSubmitting}>
            Review ballot
          </Button>
        )}
      </div>
    </div>
  );
}

interface VoteReviewPanelProps {
  polls: PollSlide[];
  selections: Record<number, number>;
  onEdit: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function VoteReviewPanel({ polls, selections, onEdit, onConfirm, isSubmitting = false }: VoteReviewPanelProps) {
  const selectedSummary = useMemo(() => {
    return polls.map((poll) => {
      const selection = poll.options.find((option) => option.id === selections[poll.id]);
      return { pollTitle: poll.title, optionName: selection?.name ?? "No selection" };
    });
  }, [polls, selections]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review your ballot</CardTitle>
          <CardDescription>Double-check each response before you submit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedSummary.map((item) => (
            <div key={item.pollTitle} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">{item.pollTitle}</p>
              <p className="text-sm text-slate-600">{item.optionName}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onEdit}>
          Edit selections
        </Button>
        <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit ballot"}
        </Button>
      </div>
    </div>
  );
}

interface NotificationPreferencesPanelProps {
  initialPreferences?: {
    emailResults: boolean;
    smsResults: boolean;
    weeklyDigest: boolean;
  };
}

export function NotificationPreferencesPanel({ initialPreferences }: NotificationPreferencesPanelProps) {
  const [prefs, setPrefs] = useState(initialPreferences ?? {
    emailResults: true,
    smsResults: false,
    weeklyDigest: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" />
          Notification preferences
        </CardTitle>
        <CardDescription>Choose how members should receive result alerts and reminders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { key: "emailResults", label: "Email me when results are published" },
          { key: "smsResults", label: "SMS nudges before voting closes" },
          { key: "weeklyDigest", label: "Weekly digest for active elections" },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{item.label}</p>
              <p className="text-xs text-slate-500">Managed at the organization level.</p>
            </div>
            <Switch
              checked={prefs[item.key as keyof typeof prefs]}
              onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, [item.key]: checked }))}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface VoterTokenDisplayProps {
  token: string;
}

export function VoterTokenDisplay({ token }: VoterTokenDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          One-time voter token
        </CardTitle>
        <CardDescription>Share this once to confirm the voter can cast a ballot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-700">{token}</div>
        <Button type="button" variant="outline" size="sm" onClick={copyToken}>
          <Copy className="mr-1 h-4 w-4" />
          {copied ? "Copied" : "Copy token"}
        </Button>
      </CardContent>
    </Card>
  );
}
