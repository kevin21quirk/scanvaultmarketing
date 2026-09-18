# ScanVault Marketing — Lead Engine & CRM

A marketing CRM for **ScanVault Limited**, built to discover, track and convert UK care homes into customers for document scanning, archiving and digitalisation services.

![ScanVault](public/scanvaultlogo.png)

## Features

- **Lead Discovery Engine** — pull every registered care home in England straight from the **CQC (Care Quality Commission) register** with filters for region, local authority, postcode, rating and provider. CSV import for your own lists.
- **Full CRM** — searchable/filterable/sortable lead database with bulk actions, tags, owners, priorities and lead scoring (beds, CQC rating, reachability, care-type fit).
- **Pipeline Kanban** — drag-and-drop workflow stages (New → Researching → Contacted → Engaged → Meeting → Proposal → Won/Lost/Nurture), fully customisable in Settings.
- **Contacts** — track decision-makers (registered managers, owners) per lead with primary-contact flagging.
- **Activity Timeline** — log calls, emails, meetings, letters, SMS and LinkedIn touches with outcomes; follow-up scheduling built in.
- **Tasks** — global + per-lead task boards with overdue highlighting.
- **Campaigns & Sequences** — drip workflows (day-N emails/calls/tasks) and one-off campaign pushes with sent/replied/bounced tracking.
- **Email Templates** — reusable outreach copy with `{{name}}`, `{{firstName}}`, `{{town}}`, `{{providerName}}`, `{{cqcRating}}` merge fields.
- **Analytics** — acquisition trends, pipeline funnel, regional coverage, CQC rating mix, outreach-by-channel.
- **Auth** — JWT session auth, team management with admin/user roles.

## Tech Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind CSS** + Radix UI primitives (ScanVault branding — `#DC2626` red, `#0A0A0A` black)
- **Prisma 5** + **Neon Postgres**
- **Recharts**, **dnd-kit**, **sonner**, **jose** (JWT), **bcryptjs**

## Getting Started

```bash
npm install
```

Create `.env` (see `.env.example`):

```env
DATABASE_URL="postgresql://USER:PASS@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"
AUTH_SECRET="generate-a-random-32+-char-secret"
CQC_API_KEY=""           # optional, for higher CQC rate limits
```

Push the schema and seed:

```bash
npm run db:push
npm run db:seed
```

Run:

```bash
npm run dev
```

Seed login: **admin@scanvault.co.uk** / **ScanVault2024!** (change immediately).

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel → **New Project** → import the repo.
3. Add env vars: `DATABASE_URL`, `AUTH_SECRET`, optionally `CQC_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `SMTP_*`.
4. Deploy — the build runs `prisma generate && next build` automatically.
5. After first deploy, run `npm run db:push && npm run db:seed` locally (or a one-off Vercel function) to create tables + the admin user.

## Lead Sources

| Source | How it works |
|---|---|
| **CQC register** | `/discover` — filter by region/local authority/postcode/rating, preview, then bulk-import. Dedupes by CQC location ID and refreshes ratings on re-import. |
| **CSV upload** | `/discover` → CSV tab — column names auto-matched. |
| **Manual** | `/leads/new` — full form with care-sector fields. |

Pro tip: homes rated **"Requires improvement"** or **"Inadequate"** usually have documentation pain — the scoring engine boosts them automatically.
