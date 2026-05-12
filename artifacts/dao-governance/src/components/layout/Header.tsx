import { Link, useLocation } from "wouter";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Vote, LayoutDashboard, Building2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daos", label: "DAOs", icon: Building2 },
  { href: "/proposals", label: "Proposals", icon: FileText },
];

export function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-sidebar/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Vote className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-sm tracking-tight">
                DAOvote
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? location === "/" : location.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
