# FinFlux — Personal Finance Tracker

> *"No LLM calls. No black boxes. Just rules, parsers, and real work."*

**FinFlux** is a full-stack personal finance tracker that auto-categorizes every transaction from your bank statement PDF — no AI APIs, no subscriptions, just a deterministic rule engine and bank-specific parsers doing the heavy lifting.

---

## Why I did this?

Managing personal finances in India means juggling statements from HDFC, SBI, and a dozen other banks — each with its own export format, column layout, and quirks. Every existing tool either calls a paid LLM API, requires manual CSV entry, or simply gives up on Indian bank formats. I built FinFlux to solve that: upload any bank statement PDF and get every transaction auto-categorized instantly, with full control over the rules and zero dependency on external AI services.

---

## How did it solve?

FinFlux uses a **Strategy Pattern** to handle the chaos of bank-specific PDF formats. A `ParserService` tries each bank parser in order — HDFC → SBI → Generic fallback — where each self-selects via a `canHandle()` check. Once parsed, a **rule-based classification engine** matches each transaction description against ~70 pre-seeded rules (keyword or regex) to assign categories. Users can override any category manually, and those overrides are flagged with `isManualOverride` so they survive future re-processing. The result: structured, categorized transaction data powering a live spending dashboard.

---

## Key Features

### 1. PDF Statement Parsing
Upload bank statement PDFs from **HDFC**, **SBI**, or any generic format. The backend automatically detects the bank and applies the correct parser to extract clean, structured transaction data — handling multi-line narrations, DR/CR suffixes, comma-formatted amounts, and page-break misalignment.

### 2. Automatic Transaction Categorization
Powered by a **pure rule-based classification engine** (no LLMs), each transaction description is matched against ~70 pre-seeded rules across categories like Food, Travel, Utilities, Shopping, and more. Rules support both keyword matching and full regex patterns with configurable priority.

### 3. Custom Rule Management
Build your own categorization rules on top of the system defaults. Create, edit, and delete custom rules from the UI. Your rules are applied first (higher priority), giving you full control over how your spending is classified.

### 4. Spending Analytics Dashboard
Visualize your finances with three live charts:
- **Category Breakdown** — Pie chart of spend by category
- **Monthly Trend** — Bar chart of income vs. expense over time
- **Top Merchants** — Ranked list of your highest-spend merchants

### 5. Manual Override with Persistence
Override any auto-assigned category inline from the Transactions table. Overrides are flagged with `isManualOverride = true`, so they are never silently reverted if a statement is reprocessed later.

### 6. Clean, Responsive UI
Built with **React 18 + TypeScript + Tailwind CSS** on a Vite frontend. Features a drag-and-drop PDF upload, paginated transaction tables with inline editing, and a dashboard that updates on every upload.

---

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | NestJS (Node.js), TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (passport-jwt + bcryptjs) |
| PDF Parsing | pdf-parse |
| Classification | Pure rule-based engine (no LLMs) |
| Infrastructure | Docker, Docker Compose |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (or use the Docker setup below)

### Installation

**1. Clone the repository:**
```bash
git clone https://github.com/VinaySuhirthan/FinFlux.git
cd FinFlux
```

**2. Docker (fastest — full stack in one command):**
```bash
docker-compose up --build
# frontend: http://localhost:5173
# backend:  http://localhost:3001

```

**3. Manual setup:**

Configure environment — create a `.env` file in `/backend`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/finflux
JWT_SECRET=your_jwt_secret
PORT=3001
```

```bash
# Start Postgres
docker run -d --name finflux_db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=finflux \
  -p 5432:5432 postgres:15-alpine

# Backend
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed        # seeds categories + ~70 system rules
npm run start:dev          # http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

---

## Project Structure

```
FinFlux/
├── backend/src/
│   ├── auth/                    # JWT register/login
│   ├── statements/              # PDF upload + async processing
│   ├── parser/
│   │   ├── interfaces/          # Shared BankParser interface
│   │   └── strategies/
│   │       ├── hdfc.strategy.ts      # HDFC-specific parser
│   │       ├── sbi.strategy.ts       # SBI-specific parser
│   │       └── generic.strategy.ts   # Heuristic fallback
│   ├── classification/          # Rule-matching engine
│   ├── rules/                   # User-managed rule CRUD
│   └── analytics/               # Dashboard aggregations
├── frontend/src/pages/
│   ├── Login / Register
│   ├── Upload                   # Drag-and-drop PDF upload
│   ├── Statements / Transactions
│   ├── Dashboard                # Category pie, monthly bar, top merchants
│   └── Rules                    # Custom rule management
├── finflux.sql                  # Database dump
├── docs/                        # Additional documentation
└── scripts/                     # Utility scripts
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login |
| GET | /auth/me | Get current user |
| POST | /statements/upload | Upload PDF |
| GET | /statements | List all statements |
| GET | /statements/:id | Statement details + logs |
| DELETE | /statements/:id | Delete statement |
| GET | /statements/:id/transactions | Paginated transactions |
| PATCH | /transactions/:id/category | Update single category |
| POST | /transactions/bulk-categorize | Bulk category update |
| GET | /categories | All categories |
| GET | /analytics/summary | Totals |
| GET | /analytics/category-breakdown | Spend by category |
| GET | /analytics/monthly-trend | Monthly income/expense |
| GET | /analytics/top-merchants | Top spending merchants |
| GET | /rules | All rules (user + system) |
| POST | /rules | Create custom rule |
| PATCH | /rules/:id | Update rule |
| DELETE | /rules/:id | Delete user rule |
| POST | /classification/reprocess/:id | Re-classify statement |

> All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

---

## Performance & Design Decisions

- **`Decimal(15,2)` not `float`** — All amount fields use Prisma's Decimal type. Financial arithmetic on floats accumulates silent rounding errors; this prevents totals from drifting.
- **Strategy Pattern for parsers** — HDFC and SBI have completely different column layouts. Each parser self-declares via `canHandle()`, tried in sequence with a generic heuristic as the final fallback. Adding a new bank = one new file, zero changes to existing code.
- **`isManualOverride` flag** — Auto-categorization is only useful if wrong guesses are fixable and *stay* fixed. This flag ensures user corrections survive re-processing.
- **Rule priority system** — User-defined rules run before system rules, giving users full control without modifying seeded data.

---

## Adding a New Bank Parser

1. Create `backend/src/parser/strategies/mybank.strategy.ts` implementing `BankParser`
2. Register it in the parsers array in `parser.service.ts` (before `GenericParser`)
3. Implement `canHandle()` to detect bank-specific text markers
4. Implement `parse()` to extract `ParsedTransaction[]`

```typescript
interface BankParser {
  name: string;
  canHandle(text: string): boolean;
  parse(text: string): ParseResult;
}
```

---

## Assumptions & Limitations

**PDF Parsing**
- Text-based PDFs only — scanned/image PDFs won't parse. Use "Save as PDF" from net banking, not a photo or scan.
- HDFC parser targets HDFC Net Banking's tab/multi-space column format; multi-line narrations may be partially captured.
- SBI parser targets SBI's text export format; alignment variations may cause field misassignment.
- Generic fallback is heuristic-based — works for simple layouts, may misattribute debit/credit in ambiguous ones.
- Commas in amounts and DR/CR suffixes are handled correctly.

**Classification**
- Rules match against normalized description text only (not amount or date).
- UPI transactions default to "Transfers" since the real merchant is often buried in the reference number.
- Pre-seeded rules cover common Indian bank merchants/services; regional or obscure ones fall to Uncategorized.

**Scope**
- Single user per session, no multi-tenant sharing.
- Uploads stored on local disk (`./uploads/`) — architecture is S3-ready by swapping the multer storage adapter in `StatementsController`.
- Parsing runs in-process after upload (no job queue yet).
- No email verification or password reset flow.

---

## Future Improvements

- [ ] Background job queue (Bull + Redis) for PDF processing
- [ ] S3 upload support
- [ ] Cross-statement analytics
- [ ] CSV export of transactions
- [ ] Budget tracking and alerts
- [ ] Recurring transaction detection
- [ ] Credit card statement support (separate billing cycle handling)
- [ ] Multi-currency support
- [ ] More bank parsers (Axis, ICICI, Kotak)

---

## SNAPS:


<img width="1600" height="778" alt="image" src="https://github.com/user-attachments/assets/6b0518dc-492c-418d-9333-cf78b1db85d7" />


Team HacksON
Created for the CSI ORIGIN(VIT)

Lead Developer: Vinay Suhirthan
