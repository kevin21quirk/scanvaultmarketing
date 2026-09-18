import nodemailer from "nodemailer";

// SMTP transport — configured via SMTP_* env vars.
// Returns null transporter when not configured so callers can degrade
// gracefully (e.g. log the email as an activity instead of sending).

export function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransport();
  if (!transport) return { sent: false, error: "SMTP not configured" };
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || "ScanVault <hello@scanvault.co.uk>",
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Merge {{field}} placeholders with lead/contact data. */
export function mergeFields(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}
