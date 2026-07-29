import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { useGetResults, useGetAuditTrail } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Trophy, Users, Vote, BarChart3, ShieldCheck, ExternalLink, Lock, Clock,
} from "lucide-react";

type CandidateResult = {
  id: number;
  name: string;
  description?: string | null;
  voteCount: number;
  percentage: number;
  rank: number;
  isWinner: boolean;
};

type ResultData = {
  electionId: number;
  title: string;
  type: string;
  status: string;
  totalVotes: number;
  voterCount: number;
  turnout: number;
  candidates: CandidateResult[];
  winner: CandidateResult | null;
  closedAt?: string | null;
  orgName?: string;
  resultsHidden?: boolean;
};

const COLORS = ["#2563eb", "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];

export default function Results() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const electionId = parseInt(id);

  const { data: results, isLoading, error: resultsError } = useGetResults(electionId) as {
    data: ResultData | undefined;
    isLoading: boolean;
    error: unknown;
  };
  const { data: audit } = useGetAuditTrail(electionId) as {
    data: {
      electionHash?: string;
      votes: { id: number; voteHash: string; txSignature: string; blockHeight: number; createdAt: string }[];
      integrityVerified?: boolean;
    } | undefined;
    isLoading: boolean;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-72" />
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Results hidden while election is active (Feature 5)
  const isHidden =
    (resultsError as { status?: number })?.status === 403 ||
    results?.resultsHidden === true;

  if (isHidden) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <Link href={`/orgs/${slug}/elections/${id}`}>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              Back to election
            </button>
          </Link>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">Results are sealed</h1>
            <p className="text-slate-500 max-w-sm mx-auto">
              Tallies are hidden while voting is in progress. Results will be published automatically when the election closes.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-blue-600">
              <Clock className="w-4 h-4" />
              Check back when the election ends
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <p className="text-slate-500">Results not available.</p>
          <Link href={`/orgs/${slug}`}>
            <Button className="mt-4" variant="outline">Back to organization</Button>
          </Link>
        </div>
      </div>
    );
  }

  const chartData = results.candidates.map((c) => ({
    name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
    fullName: c.name,
    votes: c.voteCount,
    pct: c.percentage,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link href={`/orgs/${slug}/elections/${id}`}>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              Back to election
            </button>
          </Link>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {results.status === "closed" ? "Final results" : "Results"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{results.title}</h1>
            {results.orgName && <p className="text-slate-500 mt-1">{results.orgName}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total votes", value: results.totalVotes, icon: Vote },
              { label: "Eligible voters", value: results.voterCount, icon: Users },
              { label: "Turnout", value: `${results.turnout}%`, icon: BarChart3 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-4 text-center">
                <stat.icon className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {results.winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 mb-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium mb-0.5">Winner</p>
                <p className="text-xl font-bold">{results.winner.name}</p>
                <p className="text-blue-100 text-sm">{results.winner.voteCount} votes · {results.winner.percentage}%</p>
              </div>
            </motion.div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-slate-800 mb-4">Vote breakdown</h2>
            {results.candidates.length > 0 && results.totalVotes > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    formatter={(value: number, _: string, props: { payload?: { fullName?: string; pct?: number } }) => [
                      `${value} votes (${props.payload?.pct ?? 0}%)`,
                      props.payload?.fullName ?? "",
                    ]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                  />
                  <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">No votes have been cast yet.</p>
            )}

            <div className="mt-4 space-y-3">
              {results.candidates.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-6 text-sm text-slate-400 text-right flex-shrink-0">#{c.rank}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${c.isWinner ? "text-blue-700" : "text-slate-700"}`}>
                        {c.name}
                        {c.isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-500 inline ml-1" />}
                      </span>
                      <span className="text-sm text-slate-500">{c.voteCount} ({c.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${c.isWinner ? "bg-blue-500" : "bg-slate-300"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.percentage}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {audit && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  Blockchain audit trail
                </h2>
                {audit.integrityVerified && (
                  <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                    ✓ Integrity verified
                  </span>
                )}
              </div>
              {audit.electionHash && (
                <div className="mb-4 bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Election hash</p>
                  <p className="text-xs font-mono text-slate-600 break-all">{audit.electionHash}</p>
                </div>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {audit.votes.slice(0, 20).map((v, i) => (
                  <div key={v.id} className="flex items-center gap-3 text-xs border border-slate-100 rounded-lg p-2.5">
                    <span className="text-slate-400 flex-shrink-0 w-5 text-center">#{i + 1}</span>
                    <span className="font-mono text-slate-500 truncate flex-1">{v.voteHash}</span>
                    <span className="text-slate-400 flex-shrink-0">Block {v.blockHeight.toLocaleString()}</span>
                    {v.txSignature && (
                      <a
                        href={`https://explorer.solana.com/tx/${v.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-500 hover:text-blue-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {audit.votes.length > 20 && (
                <p className="text-xs text-slate-400 text-center mt-2">Showing 20 of {audit.votes.length} votes</p>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
