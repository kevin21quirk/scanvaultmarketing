// Lead scoring — higher = hotter prospect for ScanVault document digitisation.

type ScorableLead = {
  beds?: number | null;
  cqcRating?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  careTypes?: string[];
  lastContactedAt?: Date | null;
};

export function scoreLead(lead: ScorableLead): number {
  let score = 0;

  // Larger homes = more records = bigger opportunity
  if (lead.beds != null) {
    if (lead.beds >= 60) score += 30;
    else if (lead.beds >= 40) score += 22;
    else if (lead.beds >= 20) score += 15;
    else score += 8;
  }

  // Poor CQC ratings often mean documentation/compliance pain
  if (lead.cqcRating === "Requires improvement") score += 20;
  else if (lead.cqcRating === "Inadequate") score += 25;
  else if (lead.cqcRating === "Good") score += 10;
  else if (lead.cqcRating === "Outstanding") score += 5;

  // Reachability
  if (lead.phone) score += 10;
  if (lead.email) score += 15;
  if (lead.website) score += 5;

  // Care-type fit (nursing/residential homes keep heavy records)
  const types = lead.careTypes ?? [];
  if (types.some((t) => /nurs/i.test(t))) score += 10;
  if (types.some((t) => /dementia/i.test(t))) score += 8;
  if (types.some((t) => /residential/i.test(t))) score += 6;

  return Math.min(score, 100);
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Hot", color: "#DC2626" };
  if (score >= 45) return { label: "Warm", color: "#F59E0B" };
  return { label: "Cold", color: "#3B82F6" };
}
