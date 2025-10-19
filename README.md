# BloomTrack

Seller management and lightweight analytics app. Add sellers, record purchases and sales, view history, and explore a combined 3D analytics chart.

## Features
- Add/Search sellers by serial number
- Purchases & sales tracking with running totals
- Per-seller PDF export (row action)
- History views for purchases and sales
- 3D Analytics combining Weight (kg) and Amount (₹)

## Tech Stack
- Frontend: React, TypeScript, Vite, Tailwind, shadcn-ui
- Backend: Express, PostgreSQL (Neon), JWT auth

## Prerequisites
- Node.js 18+
- Neon PostgreSQL database (or any Postgres)

## Setup
```bash
git clone https://github.com/nithingowda06/BloomTrack.git
cd BloomTrack
npm install
```

Create the database objects (run once in your DB):
```sql
-- Use the provided schema
-- open database/schema.sql and run its contents
```

Create an `.env` (not committed):
```
DATABASE_URL=postgres://user:pass@host/db
JWT_SECRET=your-strong-secret
```

## Run
Open two terminals:

Terminal 1 (server):
```bash
npm run server:dev
```

Terminal 2 (web):
```bash
npm run dev
```

## 3D Analytics dependencies
Already added to package.json. If needed, install manually:
```bash
npm i echarts echarts-gl echarts-for-react
```
Open Analytics → shows a 3D bar chart with both metrics.

## Serial number uniqueness (owner-scoped)
If you need serial numbers unique per owner (recommended), ensure a composite unique index:
```sql
-- Drop any global unique on serial_number if it exists, then
CREATE UNIQUE INDEX IF NOT EXISTS uniq_owner_serial ON public.sellers (owner_id, serial_number);
```

## Project Structure
```
├── src/
│   ├── components/
│   ├── lib/
│   └── pages/
├── server/
│   ├── routes/
│   ├── middleware/
│   └── db.ts
├── database/
│   └── schema.sql
└── .env (ignored)
```

## Common commands
```bash
# start
npm run server:dev  # backend
npm run dev         # frontend

# push to GitHub
git add -A && git commit -m "update" && git push
```

## Security notes
- Do not commit `.env`
- Use strong, unique `JWT_SECRET`
