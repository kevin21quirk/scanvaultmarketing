// Shared constants for the ScanVault Marketing CRM

export const DEFAULT_STAGES = [
  { name: "New Lead", order: 0, color: "#6B7280", isDefault: true },
  { name: "Researching", order: 1, color: "#3B82F6" },
  { name: "Contacted", order: 2, color: "#8B5CF6" },
  { name: "Engaged", order: 3, color: "#F59E0B" },
  { name: "Meeting Booked", order: 4, color: "#10B981" },
  { name: "Proposal Sent", order: 5, color: "#06B6D4" },
  { name: "Negotiation", order: 6, color: "#F97316" },
  { name: "Won", order: 7, color: "#22C55E", isWon: true },
  { name: "Lost", order: 8, color: "#EF4444", isLost: true },
  { name: "Nurture", order: 9, color: "#64748B" },
];

export const UK_REGIONS = [
  "East Midlands",
  "East of England",
  "London",
  "North East",
  "North West",
  "South East",
  "South West",
  "West Midlands",
  "Yorkshire and the Humber",
  "Scotland",
  "Wales",
  "Northern Ireland",
];

export const CARE_TYPES = [
  "Residential care",
  "Nursing care",
  "Dementia care",
  "Respite care",
  "Palliative care",
  "Learning disability",
  "Mental health",
  "Physical disability",
  "Older people",
  "Younger adults",
];

export const LEAD_TYPES = [
  { value: "CARE_HOME", label: "Care Home" },
  { value: "CARE_HOME_GROUP", label: "Care Home Group" },
  { value: "HOME_CARE", label: "Home Care / Domiciliary" },
  { value: "SUPPORTED_LIVING", label: "Supported Living" },
  { value: "HOSPICE", label: "Hospice" },
  { value: "NHS_TRUST", label: "NHS Trust" },
  { value: "OTHER", label: "Other" },
];

export const ACTIVITY_TYPES = [
  { value: "CALL", label: "Phone Call", icon: "Phone" },
  { value: "EMAIL", label: "Email", icon: "Mail" },
  { value: "MEETING", label: "Meeting", icon: "Users" },
  { value: "NOTE", label: "Note", icon: "StickyNote" },
  { value: "SMS", label: "SMS", icon: "MessageSquare" },
  { value: "LETTER", label: "Letter / Mail", icon: "Send" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "Linkedin" },
];

export const ACTIVITY_OUTCOMES = [
  { value: "NONE", label: "No outcome" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "LEFT_VOICEMAIL", label: "Left voicemail" },
  { value: "SPOKE_TO_CONTACT", label: "Spoke to contact" },
  { value: "MEETING_BOOKED", label: "Meeting booked" },
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "CALL_BACK", label: "Call back later" },
  { value: "DO_NOT_CONTACT", label: "Do not contact" },
];

export const CQC_RATINGS = [
  "Outstanding",
  "Good",
  "Requires improvement",
  "Inadequate",
  "Not rated",
];

export const LEAD_SOURCES = [
  { value: "MANUAL", label: "Manual entry" },
  { value: "CQC", label: "CQC register" },
  { value: "COMPANIES_HOUSE", label: "Companies House" },
  { value: "CSV_IMPORT", label: "CSV import" },
  { value: "LINKEDIN_SALES_NAV", label: "LinkedIn Sales Navigator" },
  { value: "WEB_SEARCH", label: "Web search" },
  { value: "REFERRAL", label: "Referral" },
  { value: "INBOUND", label: "Inbound enquiry" },
  { value: "OTHER", label: "Other" },
];

export const STAGE_COLORS = [
  "#6B7280",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#F97316",
  "#22C55E",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];
