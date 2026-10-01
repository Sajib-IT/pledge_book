# PledgeBook (প্লেজ বুক) — বন্ধকী ও ঋণ ব্যবস্থাপনা

A production-ready **Mortgage & Pawn Management System** tailored for small pawn/mortgage businesses in Bangladesh. Built from **one single codebase** as both a responsive web app and an Android/iOS mobile application using **React, Vite, TypeScript, Tailwind CSS, Supabase, and Capacitor**.

---

## 🏛️ Business Rules & Financial Architecture

- **Currency (BDT)**: All monetary figures (principal, interest, payment amounts) are strictly stored and computed as **64-bit integers** (`bigint` in PostgreSQL, `Math.round()` in TypeScript) to prevent floating-point rounding errors.
- **Flat Yearly Interest Model**:
  - Configurable per loan (default: `25.00%` per year).
  - Formula: `yearly_interest = round((principal * interest_rate) / 100)`.
  - Example: A principal of ৳ 40,000 at 25% generates ৳ 10,000 flat interest per year.
- **1-Year Standard Term**:
  - **RENEW (নবায়ন)**: Customer pays only the yearly interest (৳ 10,000). Principal remains ৳ 40,000 and `due_date` automatically extends by `+1 year`.
  - **CLOSE (সমাপ্তি)**: Customer pays Principal + Interest (৳ 50,000). Mortgage status is updated to `closed` and collateral is marked as returned.
- **Loan Statuses**: `active`, `closed`, `defaulted`. **Overdue** is dynamically computed whenever `due_date < CURRENT_DATE` and `status = 'active'`.
- **Payment Immutability & Audit Trail**:
  - Payments are strictly **never edited or deleted**. A PostgreSQL `BEFORE UPDATE OR DELETE` database trigger blocks any alteration attempts.
  - Mistakes are corrected using the `add_correction(payment_id, reason)` stored procedure, which inserts a reversing negative entry and restores the previous mortgage state.
  - Full audit logging on all tables (`customers`, `mortgages`, `payments`, `profiles`) capturing user ID, timestamp, old data, and new data.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Design & Typography**: Hind Siliguri (Bangla) + Inter (English), mobile safe-area insets, dark-mode ready
- **State & Data Fetching**: TanStack Query (React Query)
- **Forms & Validation**: React Hook Form + Zod
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Auth, Private Storage)
- **Mobile Engine**: Capacitor (Android platform configured, iOS ready)
- **Plugins**:
  - `@capacitor/camera` (Capture collateral and customer photos directly from camera)
  - `@capacitor/local-notifications` (Auto-scheduled alerts 15d, 7d, 1d, and 0d before due dates)
  - `@capacitor/share` (1-click receipt and reminder sharing to WhatsApp)
  - `@capacitor/preferences` (Secure PIN lock storage)
  - `@capacitor/app` (Detects background/foreground transitions to lock app)
  - `@capacitor/network` (Network offline banner indicator)
- **PDF Generation**: `jspdf` + `html2canvas` for printable A5 customer payment slips

---

## 📱 Features

1. **Dashboard Overview**:
   - Total Outstanding Principal, Expected Interest This Month, Overdue Loans Count, Due in 15 Days.
   - Owner-only income cards for current month and fiscal year.
2. **Customer Directory**:
   - Searchable by Name, Phone, or NID number.
   - Profile view with 1-click **Call** (`tel:`) and **WhatsApp** dialers.
   - Camera photo capture & NID upload.
3. **New Mortgage Form**:
   - Customer picker with 1-click **Add Customer** modal.
   - Live Calculation Preview (Principal, Yearly Interest, Total Settlement).
   - Collateral type selector (Gold 💎, Land 📄, Vehicle 🏍️, Electronics 📺, Other).
   - Camera upload for jewelry hallmarking certificates, deeds, and items.
4. **Mortgage Details & Payment Timeline**:
   - Sequential receipt numbers (`REC-YYYYMM-XXXX`).
   - **Renew Mortgage Dialog**: Confirms exact calculated interest, pushes due date +1 year.
   - **Close Mortgage Dialog**: Confirms total settlement, closes loan, releases collateral.
   - **Reversal Dialog**: Inserts negative reversing entry for any erroneous payments.
5. **Due & Overdue Alert Center**:
   - Filter chips: *Overdue*, *Due in 7 Days*, *Due in 15 Days*, *Due in 30 Days*, *All Active*.
   - Direct WhatsApp button with pre-filled Bengali payment reminder message.
6. **Digital Receipts**:
   - Professional voucher layout with customer copy badge, business name, and Bengali currency numbers.
   - Export to PDF, print, or share via WhatsApp.
7. **App PIN / Biometric Lock**:
   - Configurable 4-digit PIN in Settings.
   - Locks the app whenever it is sent to the background and resumed.
8. **Owner Financial Reports**:
   - Portfolio breakdown and distribution.
   - 1-click CSV Export for all Mortgages and Payments Audit Trail.

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)
- (For Android) Android Studio + Android SDK (API 34+)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/Sajib-IT/pledge_book.git
cd pledge_book
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
```ini
VITE_SUPABASE_URL=https://nylrhvftijyuxtrmolcm.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
VITE_BUSINESS_NAME=মেসার্স আলম ব্রাদার্স ট্রেডার্স ও বন্ধকী
VITE_DEFAULT_INTEREST_RATE=25.00
```

### 4. Run Supabase Database Migrations
1. Open your Supabase project dashboard at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor**.
3. Copy and run [`supabase/migrations/20261001000000_initial_schema.sql`](file:///d:/Personal%20Projects/pledge_book/supabase/migrations/20261001000000_initial_schema.sql).
4. (Optional) Run [`supabase/seed.sql`](file:///d:/Personal%20Projects/pledge_book/supabase/seed.sql) to populate demo customers and loans.

### 5. Run Web Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🤖 Capacitor Android Workflow

### 1. Build Web Assets & Sync to Android
```bash
npm run build
npx cap sync android
```

### 2. Open Project in Android Studio
```bash
npx cap open android
```

### 3. Generate Signed APK / AAB for Release
1. In Android Studio, select **Build** → **Generate Signed Bundle / APK...**
2. Choose **Android App Bundle (AAB)** (for Google Play) or **APK** (for direct device installation).
3. Create a new keystore or select your existing release keystore.
4. Select `release` build variant and click **Finish**.
5. Your signed release file will be generated in `android/app/release/`.

---

## 🧪 Testing

### Run Frontend & Financial Math Unit Tests
```bash
npx vitest run
```
Executes 12 unit tests verifying flat yearly interest math, overdue edge cases, BDT formatting, and Bangla numeral translations.

### Run Database Business Logic SQL Tests
In Supabase SQL Editor:
Copy and run [`supabase/tests/business_logic_test.sql`](file:///d:/Personal%20Projects/pledge_book/supabase/tests/business_logic_test.sql) to test sequences, flat interest, and payment immutability triggers.

---

## 📄 License
Private & Proprietary — Developed for PledgeBook Mortgage Management.
