import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Star, Search } from "lucide-react";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q as string) || "";

  const contacts = await prisma.contact.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { jobTitle: { contains: q, mode: "insensitive" } },
            { lead: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: { lead: { select: { id: true, name: true } } },
    orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }],
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-scanvault-black">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} decision-makers across your leads
          </p>
        </div>
        <form method="GET" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search contacts…" className="pl-9 w-64 bg-white" />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No contacts yet — add them from individual lead pages.
            </p>
          )}
          <div className="divide-y">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <Avatar>
                  <AvatarFallback>{initials(`${c.firstName} ${c.lastName || ""}`)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    {c.isPrimary && (
                      <Badge variant="warning" className="text-[10px]">
                        <Star className="h-3 w-3 mr-0.5" /> Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.jobTitle ? `${c.jobTitle} · ` : ""}
                    <Link href={`/leads/${c.lead.id}`} className="hover:text-scanvault-red">
                      {c.lead.name}
                    </Link>
                  </p>
                </div>
                <div className="hidden sm:flex flex-col gap-1 text-sm text-muted-foreground min-w-[200px]">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 hover:text-scanvault-red truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}
                    </a>
                  )}
                  {(c.phone || c.mobile) && (
                    <a href={`tel:${c.phone || c.mobile}`} className="inline-flex items-center gap-2 hover:text-scanvault-red">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone || c.mobile}
                    </a>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/leads/${c.lead.id}`}>View lead</Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
