import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetDao, useGetDaoStats, useListProposals, getListProposalsQueryKey, ListProposalsStatus } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { VoteBar } from "@/components/VoteBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { truncateAddress, formatDate } from "@/lib/format";
import { Building2, Users, FileText, Plus, ArrowLeft } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";

const STATUS_TABS = ["all", "active", "pending", "succeeded", "defeated", "executed", "cancelled"] as const;

export default function DaoDetail() {
  const { id } = useParams();
  const daoId = parseInt(id ?? "0", 10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { publicKey } = useWallet();

  const { data: dao, isLoading: daoLoading } = useGetDao(daoId, {
    query: { enabled: !!daoId, queryKey: ["getDao", daoId] },
  });
  const { data: stats, isLoading: statsLoading } = useGetDaoStats(daoId, {
    query: { enabled: !!daoId, queryKey: ["getDaoStats", daoId] },
  });
  const statusParam = statusFilter === "all" ? undefined : statusFilter as typeof ListProposalsStatus[keyof typeof ListProposalsStatus];
  const proposalParams = statusParam ? { daoId, status: statusParam } : { daoId };
  const { data: proposals, isLoading: proposalsLoading } = useListProposals(proposalParams, {
    query: {
      enabled: !!daoId,
      queryKey: getListProposalsQueryKey(proposalParams),
    },
  });

  if (daoLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </Layout>
    );
  }

  if (!dao) {
    return (
      <Layout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">DAO not found.</p>
          <Link href="/daos"><a className="text-primary text-sm mt-2 block hover:underline">Back to DAOs</a></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/daos">
            <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{dao.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{truncateAddress(dao.governanceToken, 8)}</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5">
          <p className="text-sm text-muted-foreground">{dao.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
            <div>
              <p className="text-lg font-bold tabular-nums">{dao.totalMembers.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" />Members</p>
            </div>
            {!statsLoading && stats && (
              <>
                <div>
                  <p className="text-lg font-bold tabular-nums">{stats.totalProposals}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><FileText className="w-3 h-3" />Total Proposals</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-emerald-400">{stats.succeededProposals}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Succeeded</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums">{(stats.participationRate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              <span>Treasury: </span>
              <span className="font-mono">{truncateAddress(dao.treasuryAddress, 8)}</span>
              <span className="ml-4">Created: {formatDate(dao.createdAt)}</span>
            </div>
            {publicKey && (
              <Link href={`/daos/${daoId}/create-proposal`}>
                <Button size="sm" data-testid="button-create-proposal">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New Proposal
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Proposals */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                data-testid={`tab-${tab}`}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  statusFilter === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {proposalsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : !proposals || proposals.length === 0 ? (
            <div className="text-center py-12 bg-card border border-card-border rounded-lg">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No proposals found</p>
              {publicKey && (
                <Link href={`/daos/${daoId}/create-proposal`}>
                  <Button size="sm" variant="outline" className="mt-3">Create the first proposal</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <Link key={p.id} href={`/proposals/${p.id}`}>
                  <div className="bg-card border border-card-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer" data-testid={`proposal-card-${p.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="font-medium text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                      </div>
                      <CountdownTimer endTime={p.endTime} />
                    </div>
                    <div className="mt-3">
                      <VoteBar
                        votesFor={p.votesFor}
                        votesAgainst={p.votesAgainst}
                        votesAbstain={p.votesAbstain}
                        quorumRequired={p.quorumRequired}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
