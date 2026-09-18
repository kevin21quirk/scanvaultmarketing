import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <AppSidebar />
      </aside>

      {/* Mobile top bar + drawer */}
      <MobileNav userName={user.name} userRole={user.role} />

      <main className="flex-1 overflow-y-auto bg-gray-50 pt-14 lg:pt-0">
        <div className="min-h-full p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
