import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useGetElection,
  useCastVote,
  useGetMyVote,
  usePublishElection,
  useCloseElection,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  MultiPollVotingFlow,
  VoteReviewPanel,
  type PollSlide,
} from "@/components/features/feature-components";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  Lock,
  Users,
  Trophy,
  ExternalLink,
} from "lucide-react";

type Candidate = { id: number; name: string; description?: string | null };
type Election = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  maxChoices: number;
  candidates?: Candidate[];
  myRole?: string;
  org?: { name: string; slug: string };
};

function timeLeft(end: string) {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Voting closed";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function countdownParts(start: string) {
  const ms = Math.max(0, new Date(start).getTime() - Date.now());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return { days, hours, mins, secs };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function ElectionDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const electionId = parseInt(id);

  const [selected, setSelected] = useState<number[]>([]);
  const [voteSuccess, setVoteSuccess] = useState<{ hash: string; sig: string } | null>(null);
  const [voteError, setVoteError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [currentPollIndex, setCurrentPollIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: election, isLoading } = useGetElection(electionId) as { data: Election | undefined; isLoading: boolean };
  const { data: myVote } = useGetMyVote(electionId);

  const candidates = election?.candidates ?? [];
  const myRole = election?.myRole ?? "voter";
  const isAdmin = myRole === "admin";
  const isOfficer = ["admin", "officer"].includes(myRole);
  const hasEnoughCandidates = candidates.length >= 2;
  const hasVoted = !!(myVote as { hasVoted?: boolean })?.hasVoted || !!voteSuccess;
  const isActive = election?.status === "active";
  const isDraft = election?.status === "draft";
  const isClosed = election?.status === "closed";
  const isUpcoming = isActive && election ? now < new Date(election.startTime).getTime() : false;
  const isExpired = isActive && election ? now > new Date(election.endTime).getTime() : false;
  const maxChoices = election
    ? election.type === "single" || election.type === "yesno"
      ? 1
      : election.maxChoices ?? 1
    : 1;

  const pollSlides = useMemo<PollSlide[]>(() => {
    if (!candidates.length) return [];
    return [
      {
        id: 1,
        title: "Main ballot",
        description: "Select your preferred option for this election.",
        options: candidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          description: candidate.description ?? undefined,
          imageUrl: undefined,
        })),
      },
    ];
  }, [candidates]);

  const castVoteMutation = useCastVote({
    mutation: {
      onSuccess(data) {
        setVoteSuccess({ hash: (data as { voteHash: string }).voteHash, sig: (data as { txSignature: string }).txSignature });
        qc.invalidateQueries();
      },
      onError(err: unknown) {
        setVoteError((err as { data?: { error?: string } })?.data?.error ?? "Failed to cast vote");
      },
    },
  });

  const publishMutation = usePublishElection({
    mutation: {
      onSuccess() { qc.invalidateQueries(); },
    },
  });

  const closeMutation = useCloseElection({
    mutation: {
      onSuccess() {
        qc.invalidateQueries();
        navigate(`/orgs/${slug}/elections/${electionId}/results`);
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="h-4 bg-slate-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <h2 className="text-xl font-bold text-slate-800">Election not found</h2>
        </div>
      </div>
    );
  }

  function toggleCandidate(cid: number) {
    if (hasVoted || !isActive) return;
    if (maxChoices === 1) {
      setSelected([cid]);
    } else {
      setSelected((prev) =>
        prev.includes(cid) ? prev.filter((x) => x !== cid) : prev.length < maxChoices ? [...prev, cid] : prev,
      );
    }
  }

  function handleVote() {
    setVoteError("");
    castVoteMutation.mutate({ id: electionId, data: { choices: selected } });
  }

  function handleSelectPollOption(pollId: number, optionId: number) {
    void pollId;
    toggleCandidate(optionId);
  }

  function goToNextSlide() {
    if (currentPollIndex < pollSlides.length - 1) {
      setCurrentPollIndex((prev) => prev + 1);
    }
  }

  function goToPreviousSlide() {
    setCurrentPollIndex((prev) => Math.max(prev - 1, 0));
  }

  function handleReview() {
    setReviewMode(true);
  }

  function handleEditSelections() {
    setReviewMode(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link href={`/orgs/${slug}`}>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              {election.org?.name ?? "Back"}
            </button>
          </Link>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className={`px-6 py-5 ${isActive ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "bg-slate-50 border-b border-slate-100"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isActive ? "bg-white/20 text-white" : isClosed ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"}`}>
                  {election.status === "active" ? "● Live" : election.status === "draft" ? "Draft" : "Closed"}
                </span>
                <span className={`text-xs ${isActive ? "text-blue-100" : "text-slate-400"} capitalize`}>{election.type} choice</span>
              </div>
              <h1 className={`text-xl font-bold mb-1 ${isActive ? "text-white" : "text-slate-900"}`}>{election.title}</h1>
              {election.description && (
                <p className={`text-sm ${isActive ? "text-blue-100" : "text-slate-500"}`}>{election.description}</p>
              )}
              <div className={`flex items-center gap-4 mt-3 text-sm ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {isUpcoming
                    ? `Voting opens ${formatDate(election.startTime)}`
                    : isActive
                    ? timeLeft(election.endTime)
                    : isClosed
                    ? `Ended ${formatDate(election.endTime)}`
                    : `Opens ${formatDate(election.startTime)}`}
                </span>
                {isActive && (
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    Your vote is private
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              {isDraft && isOfficer && (
                <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-sm text-amber-700 mb-3">
                    This election is in draft mode. Publish it to allow members to vote.
                    {candidates.length < 2 && " Add at least 2 candidates before publishing."}
                  </p>
                  {isOfficer && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      disabled={!hasEnoughCandidates || publishMutation.isPending}
                      onClick={() => publishMutation.mutate({ id: electionId })}
                    >
                      {publishMutation.isPending ? "Publishing…" : "Publish election"}
                    </Button>
                  )}
                </div>
              )}

              {isClosed && (
                <div className="mb-6 flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-sm text-slate-600">This election is closed. View the final results.</p>
                  <Link href={`/orgs/${slug}/elections/${electionId}/results`}>
                    <Button size="sm" variant="outline">
                      <BarChart3 className="w-4 h-4 mr-1.5" />
                      View results
                    </Button>
                  </Link>
                </div>
              )}

              {voteSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Vote recorded on-chain!</h3>
                  <p className="text-slate-500 text-sm mb-4">
                    {voteSuccess.sig
                      ? "Your ballot has been anchored to the Solana blockchain."
                      : "Your vote is recorded. On-chain confirmation is processing."}
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Vote hash (SHA-256)</p>
                      <p className="text-xs font-mono text-slate-600 break-all">{voteSuccess.hash}</p>
                    </div>
                    {voteSuccess.sig && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Solana transaction</p>
                        <a
                          href={`https://explorer.solana.com/tx/${voteSuccess.sig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-mono break-all underline underline-offset-2"
                        >
                          {voteSuccess.sig.slice(0, 32)}…{voteSuccess.sig.slice(-8)}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        <p className="text-[11px] text-slate-400 mt-1">Opens Solana Explorer (devnet)</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : hasVoted ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">You've already voted</h3>
                  <p className="text-slate-500 text-sm">Your vote has been securely recorded.</p>
                </div>
              ) : isUpcoming ? (
                <div className="py-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Voting hasn't opened yet</h3>
                  <p className="text-slate-500 text-sm mb-6">
                    Candidates will be revealed when voting begins on {formatDate(election.startTime)}.
                  </p>
                  <CountdownTimer target={election.startTime} now={now} />
                </div>
              ) : isClosed || isExpired ? (
                <div className="py-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Voting has ended</h3>
                  <p className="text-slate-500 text-sm mb-6">
                    This poll closed on {formatDate(election.endTime)}. No more votes can be submitted.
                  </p>
                  <Link href={`/orgs/${slug}/elections/${electionId}/results`}>
                    <Button variant="outline" className="gap-2">
                      <BarChart3 className="w-4 h-4" />
                      View results
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <h2 className="font-semibold text-slate-800 mb-1">
                      {maxChoices === 1 ? "Select one option" : `Select up to ${maxChoices} options`}
                    </h2>
                    {!isActive && <p className="text-sm text-slate-500">Voting is not currently open.</p>}
                  </div>

                  {voteError && (
                    <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {voteError}
                    </div>
                  )}

                  {isActive && !reviewMode && pollSlides.length > 0 && (
                    <MultiPollVotingFlow
                      polls={pollSlides}
                      currentPollIndex={currentPollIndex}
                      selections={{ 1: selected[0] }}
                      onSelect={handleSelectPollOption}
                      onNext={goToNextSlide}
                      onPrevious={goToPreviousSlide}
                      onReview={handleReview}
                      isSubmitting={castVoteMutation.isPending}
                    />
                  )}

                  {isActive && reviewMode && pollSlides.length > 0 && (
                    <VoteReviewPanel
                      polls={pollSlides}
                      selections={{ 1: selected[0] }}
                      onEdit={handleEditSelections}
                      onConfirm={handleVote}
                      isSubmitting={castVoteMutation.isPending}
                    />
                  )}

                  {isActive && (
                    <div className="mt-4 text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Your identity is not linked to your ballot
                    </div>
                  )}
                </>
              )}

              {isClosed && isAdmin && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/orgs/${slug}/elections/${electionId}/results`)}
                  >
                    <BarChart3 className="w-4 h-4 mr-1.5" />
                    Full results & audit
                  </Button>
                </div>
              )}

              {isActive && isAdmin && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={closeMutation.isPending}
                    onClick={() => closeMutation.mutate({ id: electionId })}
                  >
                    {closeMutation.isPending ? "Closing…" : "Close election early"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function CountdownTimer({ target, now }: { target: string; now: number }) {
  const { days, hours, mins, secs } = countdownParts(target);
  void now;
  const units = [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Min", value: mins },
    { label: "Sec", value: secs },
  ];
  return (
    <div className="flex items-center justify-center gap-3">
      {units.map((u) => (
        <div key={u.label} className="bg-blue-50 rounded-xl px-4 py-3 min-w-[64px]">
          <p className="text-2xl font-bold text-blue-700 tabular-nums">{String(u.value).padStart(2, "0")}</p>
          <p className="text-[11px] font-medium text-blue-400 uppercase tracking-wide mt-0.5">{u.label}</p>
        </div>
      ))}
    </div>
  );
}
