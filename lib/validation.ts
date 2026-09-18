import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  akaName: z.string().optional().nullable(),
  type: z
    .enum(["CARE_HOME", "CARE_HOME_GROUP", "HOME_CARE", "SUPPORTED_LIVING", "HOSPICE", "NHS_TRUST", "OTHER"])
    .default("CARE_HOME"),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  town: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().default("England"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  website: z.string().optional().nullable(),
  cqcLocationId: z.string().optional().nullable(),
  cqcProviderId: z.string().optional().nullable(),
  cqcRating: z.string().optional().nullable(),
  beds: z.coerce.number().int().optional().nullable(),
  careTypes: z.array(z.string()).default([]),
  providerName: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
  source: z
    .enum(["MANUAL", "CQC", "COMPANIES_HOUSE", "CSV_IMPORT", "WEB_SEARCH", "REFERRAL", "INBOUND", "OTHER"])
    .default("MANUAL"),
  sourceDetail: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  estimatedValue: z.coerce.number().optional().nullable(),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

export const contactSchema = z.object({
  leadId: z.string().min(1),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  linkedIn: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const activitySchema = z.object({
  leadId: z.string().min(1),
  contactId: z.string().optional().nullable(),
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "SMS", "LETTER", "LINKEDIN"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND"),
  outcome: z
    .enum(["NONE", "NO_ANSWER", "LEFT_VOICEMAIL", "SPOKE_TO_CONTACT", "MEETING_BOOKED", "INTERESTED", "NOT_INTERESTED", "CALL_BACK", "DO_NOT_CONTACT"])
    .default("NONE"),
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  durationMin: z.coerce.number().int().optional().nullable(),
  occurredAt: z.coerce.date().optional().nullable(),
  followUpAt: z.coerce.date().optional().nullable(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  leadId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

export const templateSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("general"),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const campaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["EMAIL", "CALL_BLITZ", "LINKEDIN", "DIRECT_MAIL", "MIXED"]).default("EMAIL"),
  subject: z.string().optional().nullable(),
  bodyTemplate: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  leadIds: z.array(z.string()).default([]),
});

export const sequenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  steps: z.array(
    z.object({
      delayDays: z.number().int().min(0),
      type: z.enum(["EMAIL", "CALL", "TASK", "LINKEDIN"]),
      subject: z.string().optional(),
      templateId: z.string().optional(),
      note: z.string().optional(),
    })
  ),
});
