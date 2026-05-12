import { Link } from "wouter";
import { useGetStats, useGetRecentActivity, useListDaos, useListProposals } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Skeleton } from "@/components/ui/skeleton";
import { truncateAddress, formatRelativeTime } from "@/lib/format";
import { Building2, FileText, Vote, Users, TrendingUp, ArrowRight } from "lucide-react";

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: number | string; icon: React.ElementType; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-5 flex items-start gap-4">
      <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-xs text-primary mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: daos, isLoading: daosLoading } = useListDaos();
  const { data: proposals, isLoading: proposalsLoading } = useListProposals({ status: "active" });

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governance Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">On-chain DAO voting powered by Solana</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))
          ) : (
            <>
              <StatCard label="Total DAOs" value={stats?.totalDaos ?? 0} icon={Building2} />
              <StatCard label="Total Proposals" value={stats?.totalProposals ?? 0} icon={FileText} />
              <StatCard label="Active Votes" value={stats?.activeProposals ?? 0} icon={Vote} sub="Needs your vote" />
              <StatCard label="Total Voters" value={stats?.totalVoters ?? 0} icon={Users} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Proposals */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Active Proposals</h2>
              <Link href="/proposals?status=active" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {proposalsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
              ) : proposals && proposals.length > 0 ? (
                proposals.slice(0, 5).map((p) => (
                  <Link key={p.id} href={`/proposals/${p.id}`}>
                    <div className="bg-card border border-card-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer" data-testid={`proposal-card-${p.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={p.status} />
                            {p.daoName && <span className="text-xs text-muted-foreground">{p.daoName}</span>}
                          </div>
                          <p className="font-medium text-sm truncate">{p.title}</p>
                        </div>
                        <CountdownTimer endTime={p.endTime} />
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="text-emerald-400">{p.votesFor.toLocaleString()} for</span>
                        <span className="text-red-400">{p.votesAgainst.toLocaleString()} against</span>
                        <span>{p.votesAbstain.toLocaleString()} abstain</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="bg-card border border-card-border rounded-lg p-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active proposals</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: DAOs + Activity */}
          <div className="space-y-6">
            {/* DAOs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">DAOs</h2>
                <Link href="/daos" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {daosLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
              ) : (
                (daos ?? []).slice(0, 4).map((dao) => (
                  <Link key={dao.id} href={`/daos/${dao.id}`}>
                    <div className="bg-card border border-card-border rounded-lg p-3 hover:border-primary/40 transition-colors cursor-pointer" data-testid={`dao-card-${dao.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{dao.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{dao.totalMembers.toLocaleString()} members</p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                          {dao.totalProposals} props
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Activity Feed */}
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
              ) : (
                <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
                  {(activity ?? []).slice(0, 6).map((item) => (
                    <div key={item.id} className="p-3" data-testid={`activity-item-${item.id}`}>
                      <p className="text-xs text-foreground leading-snug">{item.description}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground font-mono">{truncateAddress(item.walletAddress)}</span>
                        <span className="text-xs text-muted-foreground/60">{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {(!activity || activity.length === 0) && (
                    <div className="p-4 text-center">
                      <TrendingUp className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No activity yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
