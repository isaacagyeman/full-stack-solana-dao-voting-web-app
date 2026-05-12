import { useState } from "react";
import { Link } from "wouter";
import { useListDaos } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatDate, truncateAddress } from "@/lib/format";
import { Building2, Search, Users, FileText, ArrowRight } from "lucide-react";

export default function DaoList() {
  const [search, setSearch] = useState("");
  const { data: daos, isLoading } = useListDaos();

  const filtered = (daos ?? []).filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DAOs</h1>
            <p className="text-muted-foreground text-sm mt-1">Browse all decentralized autonomous organizations</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search DAOs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No DAOs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((dao) => (
              <Link key={dao.id} href={`/daos/${dao.id}`}>
                <div
                  className="bg-card border border-card-border rounded-lg p-5 hover:border-primary/40 transition-all duration-200 cursor-pointer group h-full flex flex-col"
                  data-testid={`dao-card-${dao.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{dao.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-4">{dao.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{dao.totalMembers.toLocaleString()} members</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      <span>{dao.totalProposals} proposals</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground/60">
                      Token: <span className="font-mono text-muted-foreground">{truncateAddress(dao.governanceToken, 6)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Created {formatDate(dao.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
