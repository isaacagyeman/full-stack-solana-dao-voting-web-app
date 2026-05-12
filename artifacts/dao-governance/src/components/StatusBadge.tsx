import { cn } from "@/lib/utils";

type Status = "active" | "pending" | "succeeded" | "defeated" | "executed" | "cancelled";

const statusConfig: Record<Status, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  pending: { label: "Pending", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  succeeded: { label: "Succeeded", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  defeated: { label: "Defeated", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  executed: { label: "Executed", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  cancelled: { label: "Cancelled", className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as Status] ?? statusConfig.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
