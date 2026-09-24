"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Linkedin, Mail, Phone, Copy, Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type LeadData = {
  name: string;
  cqcRating: string | null;
  beds: number | null;
  careTypes: string[];
  region: string | null;
  primaryContactFirstName: string | null;
};

function salutation(firstName: string | null) {
  return firstName ? `Hi ${firstName}` : "Hi there";
}

function careContext(lead: LeadData): string {
  const parts: string[] = [];
  if (lead.cqcRating) parts.push(`${lead.cqcRating} CQC-rated`);
  if (lead.beds) parts.push(`${lead.beds}-bed`);
  if (lead.careTypes.length) parts.push(lead.careTypes.slice(0, 2).join(" & ").toLowerCase());
  return parts.length ? `${parts.join(", ")} care home` : "care home";
}

function buildLinkedIn(lead: LeadData): string {
  const hi = salutation(lead.primaryContactFirstName);
  const context = careContext(lead);
  const loc = lead.region ? ` in ${lead.region}` : "";

  return `${hi},

I came across ${lead.name} — a ${context}${loc} — and wanted to reach out directly.

I work with care home operators to help them [your value proposition here], and I thought there might be a conversation worth having.

I'll keep it brief — would you be open to a 15-minute call or a quick message back? Happy to work around your schedule.

Best wishes,
[Your name]`;
}

function buildEmail(lead: LeadData): string {
  const hi = salutation(lead.primaryContactFirstName);
  const context = careContext(lead);
  const loc = lead.region ? ` in ${lead.region}` : "";
  const cqcLine = lead.cqcRating
    ? `Your CQC ${lead.cqcRating} rating shows the standard you operate to — that's exactly the kind of provider I work with.`
    : "";
  const bedsLine = lead.beds ? `With ${lead.beds} beds${loc}, I imagine keeping on top of [challenge] is a constant priority.` : "";

  return `Subject: ${lead.name} — quick question

${hi},

I came across ${lead.name} — a ${context}${loc} — and wanted to drop you a note.

${cqcLine}
${bedsLine}

I help care home managers [your value proposition]. I'm not going to oversell it — I just think it could be worth a quick conversation.

Would you be free for 15 minutes this week or next?

Best regards,
[Your name]
[Your phone number]`.replace(/\n{3,}/g, "\n\n").trim();
}

function buildPhoneScript(lead: LeadData): string {
  const firstName = lead.primaryContactFirstName;
  const context = careContext(lead);
  const loc = lead.region ? ` in ${lead.region}` : "";
  const cqcLine = lead.cqcRating
    ? `I had a look at your CQC profile — ${lead.cqcRating} rating, really impressive.`
    : "";

  return `OPENING (reception)
"Hi, could I speak with ${firstName ? firstName : "the registered manager or home manager"} please? It's [your name] calling."

─────────────────────────────────────

WHEN CONNECTED
"Hi ${firstName ?? "[name]"}, my name is [your name] — I work with care homes${loc} on [what you do].

I came across ${lead.name} — ${context}. ${cqcLine}

I just wanted to briefly introduce ourselves — I'm not trying to sell anything on this call, I just wanted to check whether [the problem you solve] is something that's on your radar at the moment?"

─────────────────────────────────────

IF INTERESTED
"Great — would it be easier to jump on a proper 15-minute call later this week, or would you prefer I send something over by email first?"

─────────────────────────────────────

IF NOT THE RIGHT TIME
"Completely understand — when would be a better time to follow up? Even just a quick email — would that be OK?"

─────────────────────────────────────

VOICEMAIL (if no answer)
"Hi ${firstName ?? "[name]"}, this is [your name] from [your company]. I was looking at ${lead.name} and just wanted to introduce what we do — we work with ${context} operators on [your value prop]. I'll drop you a quick email as well — feel free to call me back on [your number]. Thanks very much."`.trim();
}

export function OutreachCard({ lead }: { lead: LeadData }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const linkedin = buildLinkedIn(lead);
  const email = buildEmail(lead);
  const phone = buildPhoneScript(lead);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" /> Outreach templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="linkedin">
          <TabsList className="w-full">
            <TabsTrigger value="linkedin" className="flex-1">
              <Linkedin className="h-3.5 w-3.5 mr-1.5 text-[#0A66C2]" /> InMail
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              <Mail className="h-3.5 w-3.5 mr-1.5" /> Email
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex-1">
              <Phone className="h-3.5 w-3.5 mr-1.5" /> Phone
            </TabsTrigger>
          </TabsList>

          {[
            { key: "linkedin", label: "LinkedIn InMail", text: linkedin },
            { key: "email",    label: "Email",           text: email    },
            { key: "phone",    label: "Phone script",    text: phone    },
          ].map(({ key, text }) => (
            <TabsContent key={key} value={key} className="mt-3 space-y-2">
              <Textarea
                readOnly
                value={text}
                className="text-xs font-mono resize-none bg-gray-50"
                rows={key === "phone" ? 22 : 12}
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Replace <span className="bg-yellow-100 px-0.5 rounded">[bracketed]</span> placeholders before sending.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => copy(text, key)}
                >
                  {copied === key ? (
                    <><Check className="h-3.5 w-3.5 text-green-600" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy</>
                  )}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
