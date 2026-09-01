# FinFlux — Finance Analytics Platform for Variable Income Users

> *"Upload your statement. Ask anything. Get answers grounded in your actual data."*

**FinFlux** is a full-stack, multi-user finance analytics platform built specifically for **freelancers, consultants, gig workers, and anyone with variable income**. Users upload bank statement PDFs, get every transaction auto-categorized by a rule engine, query their spending through a **RAG-augmented LLM chatbot**, and receive ML-powered income forecasts and risk scores that actually account for income that changes month to month.

---

## Why I did this?

Most personal finance tools are built for people with a fixed monthly salary. But freelancers, consultants, and gig workers don't have that luxury — their income swings wildly, their bank statements are the only source of truth, and no tool was giving them the analytics they actually needed: *"Was this month a fluke or a trend? Am I at risk of a bad month? What can I realistically plan for next month?"* I built FinFlux to answer those questions — combining PDF parsing, rule-based categorization, ML income forecasting, and a RAG chatbot that can explain the numbers in plain English.

---

## How did it solve?

FinFlux tackles the problem at three layers:

**Layer 1 — Parsing & Classification:** A `ParserService` uses the **Strategy Pattern** to pick the right bank parser (HDFC → SBI → Generic fallback), each self-selecting via `canHandle()`. A **rule-based classification engine** then matches each transaction description against ~70 pre-seeded rules (keyword or regex) to assign categories. Manual overrides are flagged with `isManualOverride` so they survive future re-processing.

**Layer 2 — Variable Income ML Engine:** Five Python scripts (powered by **scikit-learn's Random Forest Regressor**) run as a data pipeline against the PostgreSQL `Analytics` table. They compute per-user: next-month income prediction (using 3-month lag features), income volatility (coefficient of variation %), income reliability score (0–100), downside risk (% of months falling below 1 std dev), and savings outlook (predicted vs. average delta). These metrics are designed specifically for users whose income is not predictable.

**Layer 3 — RAG-Augmented LLM Chatbot:** At each query, the user's complete financial context is **retrieved from the database and injected into the Gemma 4 (31B) model's system prompt** via Ollama. The model only answers using real retrieved data — no hallucinations. Voice input/output is handled by ElevenLabs (STT via Scribe v1, TTS via Multilingual v2).

---

## Key Features

### 1. PDF Statement Parsing
Upload bank statement PDFs from **HDFC**, **SBI**, or any generic format. The backend automatically detects the bank and applies the correct parser to extract clean, structured transaction data — handling multi-line narrations, DR/CR suffixes, comma-formatted amounts, and page-break misalignment.

### 2. Automatic Transaction Categorization
Powered by a **rule-based classification engine**, each transaction description is matched against ~70 pre-seeded rules across categories like Food, Travel, Utilities, Shopping, and more. Rules support both keyword matching and full regex patterns with configurable priority.

### 3. Variable Income Intelligence (ML Engine)
Built for **freelancers, gig workers, and consultants** whose income is unpredictable. Five Python scripts run a **Random Forest Regressor** pipeline on the `Analytics` table to compute per-user:
- **Income Forecast** (`income.py`) — Predicts next month's income using 3-month lag features (past income + expense history)
- **Income Volatility** (`volatility.py`) — Coefficient of variation (%) showing how much income swings month-to-month
- **Income Reliability Score** (`reliability.py`) — A 0–100 score; 100 = perfectly stable salary, lower = more variable
- **Downside Risk** (`downside.py`) — % of months where income fell more than 1 std dev below average (bad month frequency)
- **Savings Outlook** (`savings.py`) — Difference between predicted next-month income and historical average (positive = growth signal)

### 4. RAG-Augmented AI Financial Chatbot
Ask anything about your finances in plain English. The chatbot uses **Retrieval-Augmented Generation (RAG)** — at each query, the user's complete financial data (income/expense summary, category breakdown, monthly trend, top 15 merchants, last 100 transactions) is retrieved from the database and injected into the **Gemma 4 (31B)** model's system prompt via Ollama. The model is strictly constrained to answer only from this retrieved context, making hallucinations structurally impossible. Proactive insights are also generated automatically on login.

### 5. Voice Interface (STT + TTS)
Speak your questions and hear the answers. Voice input is transcribed using **ElevenLabs Scribe v1** (Speech-to-Text) and responses are converted back to audio using **ElevenLabs Multilingual v2** (Text-to-Speech), making the chatbot fully hands-free.

### 6. Custom Rule Management
Build your own categorization rules on top of the system defaults. Create, edit, and delete custom rules from the UI. Your rules are applied first (higher priority), giving you full control over how your spending is classified.

### 7. Spending Analytics Dashboard
Visualize your finances with three live charts:
- **Category Breakdown** — Pie chart of spend by category
- **Monthly Trend** — Bar chart of income vs. expense over time
- **Top Merchants** — Ranked list of your highest-spend merchants

### 8. Manual Override with Persistence
Override any auto-assigned category inline from the Transactions table. Overrides are flagged with `isManualOverride = true`, so they are never silently reverted if a statement is reprocessed later.

### 9. Multi-User Platform
Full JWT-based authentication with per-user data isolation. Every user's statements, transactions, rules, and chatbot context are scoped to their account — no data leakage between users.

---

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | NestJS (Node.js), TypeScript |
| ML Engine | Python, scikit-learn (Random Forest Regressor) |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (passport-jwt + bcryptjs) |
| PDF Parsing | pdf-parse |
| Classification | Rule-based engine (~70 pre-seeded rules) |
| LLM (RAG) | Gemma 4 31B via Ollama |
| Voice (STT/TTS) | ElevenLabs Scribe v1 / Multilingual v2 |
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
OLLAMA_BASE_URL=http://localhost:11434
ELEVENLABS_API_KEY=your_elevenlabs_api_key
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
│   ├── analytics/               # Dashboard aggregations
│   └── chatbot/                 # RAG chatbot + ElevenLabs voice
├── backend/                         # Variable income ML scripts (Python)
│   ├── income.py                    # Random Forest income forecasting
│   ├── volatility.py                # Month-to-month income volatility (%)
│   ├── reliability.py               # Income reliability score (0–100)
│   ├── downside.py                  # Downside risk (bad month frequency %)
│   └── savings.py                   # Savings outlook (predicted vs. average)
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
| POST | /chatbot/chat | Send message to RAG chatbot |
| GET | /chatbot/insights | Get proactive AI financial insights |
| POST | /chatbot/tts | Convert AI response to speech (ElevenLabs) |
| POST | /chatbot/stt | Transcribe voice input to text (ElevenLabs) |

> All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

---

## Performance & Design Decisions

- **RAG over fine-tuning** — Instead of fine-tuning an LLM on financial data (expensive, stale), the system retrieves each user's live data at query time and injects it into the prompt. The model stays grounded, costs nothing extra, and reflects the latest transactions automatically.
- **Context window as retrieval store** — User financial context (summary + categories + trend + merchants + last 100 transactions) is serialized as structured text into the system prompt. No vector DB needed — the data is compact enough to fit cleanly in Gemma 4's context window.
- **Low temperature (0.3) for accuracy** — The LLM is tuned with `temperature: 0.3` to minimize creative variation when answering fact-based financial questions, while still being conversational.
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
- Multi-user with full JWT-based isolation — each user's data is scoped to their account.
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
