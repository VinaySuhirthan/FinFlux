# finflux

Upload a bank statement PDF, get every transaction auto-categorized — no LLM calls, just a rules engine and bank-specific parsers doing real work.

## What it does

A full-stack personal finance tracker: users upload bank statement PDFs (HDFC, SBI, or generic formats), the backend parses raw statement text into structured transactions, and a rule-based classification engine auto-categorizes each one against ~70 seeded rules plus any custom rules the user defines. Users can override any category manually, browse statements and transactions, and view spending analytics — category breakdown, monthly trend, and top merchants — on a dashboard.

## Tech Stack

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)

**Auth:** JWT (bcryptjs + passport-jwt) · **PDF parsing:** pdf-parse · **Classification:** pure rule-based, no LLMs

## Architecture / How it works

```
kitna-kharcha/
├── backend/src/
│   ├── auth/            # JWT register/login
│   ├── statements/      # PDF upload + async processing
│   ├── parser/
│   │   ├── interfaces/         # shared BankParser interface
│   │   └── strategies/
│   │       ├── hdfc.strategy.ts     # HDFC-specific parser
│   │       ├── sbi.strategy.ts      # SBI-specific parser
│   │       └── generic.strategy.ts  # heuristic fallback
│   ├── classification/  # rule-matching engine
│   ├── rules/            # user-managed rule CRUD
│   └── analytics/        # dashboard aggregations
└── frontend/src/pages/
    ├── Login / Register
    ├── Upload             # drag-and-drop PDF upload
    ├── Statements / Transactions
    ├── Dashboard           # category pie, monthly bar, top merchants
    └── Rules               # custom rule management
```

**Data flow:** PDF upload → `ParserService` picks the right strategy (HDFC → SBI → Generic fallback, each self-selects via `canHandle()`) → `ClassificationService` matches each transaction description against prioritized rules (keyword or regex) → saved with category + reason → dashboard aggregates on read. Manual category overrides are flagged and survive re-classification.

```typescript
interface BankParser {
  name: string;
  canHandle(text: string): boolean;
  parse(text: string): ParseResult;
}
```

## Setup & Run

**Docker (fastest — full stack):**
```bash
docker-compose up --build
# frontend: http://localhost:5173
# backend:  http://localhost:3001

docker exec -it kitna_kharcha_backend npx prisma migrate deploy
docker exec -it kitna_kharcha_backend npx ts-node prisma/seed.ts
```

**Manual setup:**
```bash
# Postgres
docker run -d --name kitna_kharcha \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=kitna_kharcha \
  -p 5432:5432 postgres:15-alpine

# Backend
cd backend
cp .env.example .env
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

## Screenshots / Demo

**[Add a screenshot of the Dashboard — category pie + monthly trend chart]**
**[Add a screenshot of the Transactions table with inline category editing]**
**[Add a GIF of uploading a PDF → seeing it auto-categorized]**

## What I learned / Key challenges

- **Strategy pattern for parsers that don't share a format.** HDFC and SBI statements have completely different column layouts and headers — hardcoding either would break on the other. Each parser self-declares whether it can handle a given statement via `canHandle()`, tried in order with a generic heuristic parser as the final fallback, so adding a new bank later means writing one new file, not touching existing ones.
- **Designing classification to be overridable, not just automatic.** Auto-categorization is only useful if wrong guesses are easy to fix and stay fixed — `isManualOverride` flags on transactions mean a user's manual correction survives if the statement gets reprocessed later, rather than getting silently reverted.
- **Money as `Decimal`, not `float`.** Amount fields use Prisma's `Decimal(15,2)` rather than floating point, since financial arithmetic on floats silently accumulates rounding errors — a mistake that's invisible until totals stop matching.
- **Real bank statements are inconsistent.** Multi-line narrations, comma-formatted amounts, DR/CR suffixes, and page-break column misalignment in multi-page PDFs all needed explicit handling — see [Assumptions & Limitations](#assumptions--limitations) below for what's still not bulletproof.

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

All endpoints except auth require `Authorization: Bearer <token>`.

## Assumptions & Limitations

**PDF Parsing**
- Text-based PDFs only — scanned/image PDFs won't parse. Use "Save as PDF" from net banking, not a photo/scan.
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
- Parsing runs in-process after upload (no job queue yet — see below).
- No email verification or password reset flow.

## Adding a New Bank Parser

1. Create `backend/src/parser/strategies/mybank.strategy.ts` implementing `BankParser`
2. Register it in the parsers array in `parser.service.ts` (before `GenericParser`)
3. Implement `canHandle()` to detect bank-specific text markers
4. Implement `parse()` to extract `ParsedTransaction[]`

## Future Improvements

- [ ] Background job queue (Bull + Redis) for PDF processing
- [ ] S3 upload support
- [ ] Cross-statement analytics
- [ ] CSV export of transactions
- [ ] Budget tracking and alerts
- [ ] Recurring transaction detection
- [ ] Credit card statement support (separate billing cycle handling)
- [ ] Multi-currency support
