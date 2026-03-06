# Kitna Karch - Personal Finance Tracker

Upload bank statement PDFs, auto-categorize transactions with rule-based classification, and visualize your spending.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts
- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT (bcryptjs + passport-jwt)
- **PDF Parsing**: pdf-parse (text extraction)
- **Classification**: Pure rule-based (no LLMs)

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or use Docker)
- npm or yarn

### 1. Clone and navigate

```bash
cd kitna-karch
```

### 2. Start PostgreSQL (Docker shortcut)

```bash
docker run -d \
  --name kitna_pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=kitna_karch \
  -p 5432:5432 \
  postgres:15-alpine
```

Or use your local PostgreSQL instance and create the database:
```sql
CREATE DATABASE kitna_karch;
```

### 3. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env if your DB credentials differ

npm install
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed        # Seeds categories and ~70 system rules
npm run start:dev          # Starts on http://localhost:3001
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev                # Starts on http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Docker (Full Stack)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

Run migrations inside container:
```bash
docker exec -it kitna_karch_backend npx prisma migrate deploy
docker exec -it kitna_karch_backend npx ts-node prisma/seed.ts
```

---

## Architecture Overview

```
kitna-karch/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # DB schema
│   │   ├── seed.ts                # Default categories + rules
│   │   └── sample-data/           # Sample statement for testing
│   └── src/
│       ├── auth/                  # JWT auth (register/login)
│       ├── users/                 # User management
│       ├── statements/            # PDF upload + async processing
│       ├── transactions/          # CRUD + bulk categorize
│       ├── parser/
│       │   ├── interfaces/        # BankParser interface
│       │   └── strategies/
│       │       ├── generic.strategy.ts   # Fallback heuristic parser
│       │       ├── hdfc.strategy.ts      # HDFC-specific parser
│       │       └── sbi.strategy.ts       # SBI-specific parser
│       ├── classification/        # Rule-based engine
│       ├── rules/                 # User-managed rules CRUD
│       └── analytics/             # Aggregations for dashboard
└── frontend/
    └── src/
        ├── contexts/              # AuthContext
        ├── services/api.ts        # Axios API layer
        └── pages/
            ├── Login / Register
            ├── Upload             # Drag-and-drop PDF upload
            ├── Statements         # List of uploaded statements
            ├── Transactions       # Table with inline category editing
            ├── Dashboard          # Charts: category pie, monthly bar, top merchants
            └── Rules              # Custom rule management
```

### Data Flow

1. User uploads PDF → `POST /statements/upload`
2. Multer saves file to `./uploads/`
3. `StatementsService.processStatement()` runs asynchronously:
   - `ParserService.parseFile()` → selects best parser strategy → returns `ParsedTransaction[]`
   - `ClassificationService.classifyBatch()` → matches each description against rules
   - Transactions saved to DB with category + classification reason
4. Frontend polls or navigates to `/statements/:id/transactions`
5. User can manually override categories; manual overrides survive re-classification

### Classification Engine

- Rules stored in `ClassificationRule` table (seeded with ~70 built-in rules)
- Priority: higher number = matched first
- Match types: `KEYWORD` (string contains) or `REGEX` (JS regex)
- Descriptions are normalized before matching: lowercased, special chars → spaces, collapsed whitespace
- First matching rule wins; fallback = Uncategorized
- Manual overrides (`isManualOverride = true`) are preserved during reprocessing

### Parser Architecture

```typescript
interface BankParser {
  name: string;
  canHandle(text: string): boolean;
  parse(text: string): ParseResult;
}
```

Parsers are tried in order: HDFC → SBI → Generic (fallback).
Each parser's `canHandle()` inspects extracted text for bank-specific markers.

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

---

## Assumptions & Limitations

### PDF Parsing

- **Text-based PDFs only**: Scanned/image-based PDFs will fail to parse. Use "Save as PDF" from your bank's net banking portal, not a photo/scan.
- **HDFC parser**: Designed for HDFC Net Banking statement format with tab/multi-space separated columns. Multi-line narrations may be partially captured.
- **SBI parser**: Designed for SBI account statement text export. Alignment variations may cause field misassignment.
- **Generic parser**: Heuristic-based; extracts date + amounts + surrounding text. Works reasonably well for simple statements but may misattribute debit/credit in ambiguous layouts.
- **Multi-page PDFs**: pdf-parse concatenates all pages as text; this works but column alignment from page breaks can confuse parsers.
- **Commas in amounts**: Handled (e.g., "1,500.00" → 1500.00).
- **DR/CR suffix**: Handled by generic parser.

### Classification

- Rules are matched against normalized description text only (not amount or date).
- "UPI" transactions are categorized as Transfers by default since the actual merchant may appear in the narration alongside UPI reference numbers.
- Common Indian bank merchants/services are pre-seeded. Regional or obscure merchants will fall to Uncategorized.

### MVP Scope

- Single user per session (no multi-tenant sharing).
- Uploads stored on local disk (`./uploads/`). Architecture is ready for S3 by swapping the `diskStorage` in `StatementsController` with an S3 multer adapter.
- No background job queue: parsing runs in-process after upload response. For large PDFs or high concurrency, replace with Bull/Redis queue.
- No email verification or password reset flow.

---

## Adding a New Bank Parser

1. Create `backend/src/parser/strategies/mybank.strategy.ts` implementing `BankParser`
2. Add it to the parsers array in `parser.service.ts` (before GenericParser)
3. Implement `canHandle()` to detect bank-specific text patterns
4. Implement `parse()` to extract `ParsedTransaction[]`

---

## Future Improvements

- [ ] Background job queue (Bull + Redis) for PDF processing
- [ ] S3 upload support (swap multer storage)
- [ ] Multiple statement merge view (cross-statement analytics)
- [ ] CSV export of transactions
- [ ] Budget tracking and alerts
- [ ] Receipt/transaction image attachment
- [ ] Recurring transaction detection
- [ ] Credit card statement support (separate billing cycle handling)
- [ ] Multi-currency support
