"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export function MobileNav({ userName, userRole }: { userName: string; userRole: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-scanvault-black text-white flex items-center justify-between px-4 h-14 border-b border-neutral-800">
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
        <Image
          src="/scanvaultlogo.png"
          alt="ScanVault"
          width={120}
          height={36}
          className="h-8 w-auto brightness-0 invert"
          priority
        />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-[10px]">
            {initials(userName)}
          </AvatarFallback>
        </Avatar>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 h-full">
            <AppSidebar onNavigate={() => setOpen(false)} />
          </div>
          <button
            className="flex-1 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-6 w-6 text-white m-4" />
          </button>
        </div>
      )}
    </>
  );
}
