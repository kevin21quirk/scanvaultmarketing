"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Contact,
  History,
  CheckSquare,
  Radar,
  Megaphone,
  Workflow,
  FileText,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/activities", label: "Activities", icon: History },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const GROWTH = [
  { href: "/discover", label: "Discover Leads", icon: Radar },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/sequences", label: "Sequences", icon: Workflow },
  { href: "/templates", label: "Templates", icon: FileText },
];

const BOTTOM = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-scanvault-red text-white"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col bg-scanvault-black text-white">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-neutral-800">
        <Image
          src="/scanvaultlogo.png"
          alt="ScanVault"
          width={140}
          height={40}
          className="h-9 w-auto brightness-0 invert"
          priority
        />
        <div className="leading-tight">
          <div className="text-sm font-bold">
            Scan<span className="text-scanvault-red">Vault</span>
          </div>
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
            Marketing
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        {NAV.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={isActive(item.href)}
            onClick={onNavigate}
          />
        ))}
        <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Growth Engine
        </div>
        {GROWTH.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={isActive(item.href)}
            onClick={onNavigate}
          />
        ))}
        <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Insights
        </div>
        {BOTTOM.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={isActive(item.href)}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-neutral-800 p-3">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
