import { useState } from "react";
import { Link } from "wouter";
import { useListProposals, getListProposalsQueryKey, ListProposalsStatus } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { VoteBar } from "@/components/VoteBar";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

const STATUS_TABS = ["all", "active", "pending", "succeeded", "defeated", "executed", "cancelled"] as const;

export default function ProposalList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusParam = statusFilter === "all" ? undefined : statusFilter as typeof ListProposalsStatus[keyof typeof ListProposalsStatus];
  const params = statusParam ? { status: statusParam } : {};

  const { data: proposals, isLoading } = useListProposals(params, {
    query: { queryKey: getListProposalsQueryKey(params) },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground text-sm mt-1">All governance proposals across all DAOs</p>
        </div>

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

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : !proposals || proposals.length === 0 ? (
          <div className="text-center py-16 bg-card border border-card-border rounded-lg">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No proposals found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <Link key={p.id} href={`/proposals/${p.id}`}>
                <div className="bg-card border border-card-border rounded-lg p-5 hover:border-primary/40 transition-colors cursor-pointer" data-testid={`proposal-card-${p.id}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatusBadge status={p.status} />
                        {p.daoName && (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{p.daoName}</span>
                        )}
                      </div>
                      <p className="font-semibold text-sm">{p.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                    </div>
                    <div className="shrink-0">
                      <CountdownTimer endTime={p.endTime} />
                    </div>
                  </div>
                  <VoteBar
                    votesFor={p.votesFor}
                    votesAgainst={p.votesAgainst}
                    votesAbstain={p.votesAbstain}
                    quorumRequired={p.quorumRequired}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
