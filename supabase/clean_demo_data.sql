-- supabase/clean_demo_data.sql
-- Run this script in the Supabase SQL Editor to wipe all demo/test data.
-- Your Owner account, login credentials, and user profile remain 100% safe.

-- 1. Wipe all transactions, mortgages, payments, audit logs, and demo customers
TRUNCATE TABLE public.payments, public.mortgages, public.customers, public.audit_logs CASCADE;

-- 2. Reset mortgage and receipt numbering to start fresh from #1001 and #5001
ALTER SEQUENCE IF EXISTS public.mortgage_no_seq RESTART WITH 1001;
ALTER SEQUENCE IF EXISTS public.receipt_no_seq RESTART WITH 5001;

-- Confirmation output
SELECT 'All demo data wiped successfully! Your ledger is now fresh and ready for real records.' AS status;
