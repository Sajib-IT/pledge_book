-- supabase/clean_demo_data.sql
-- Run this script in your Supabase SQL Editor to wipe all demo/test data.
-- Your Owner login account, business profile, and security PIN remain 100% safe.

-- 1. Wipe all test transactions, mortgages, payments, audit logs, and demo customers
TRUNCATE TABLE public.payments, public.mortgages, public.customers, public.audit_logs CASCADE;

-- 2. Reset mortgage and receipt numbering to start fresh from #1001 and #5001
ALTER SEQUENCE IF EXISTS public.mortgage_no_seq RESTART WITH 1001;
ALTER SEQUENCE IF EXISTS public.receipt_no_seq RESTART WITH 5001;

-- 3. Optional: Create secure RPC so Owner can also wipe test data directly from the UI
CREATE OR REPLACE FUNCTION public.wipe_demo_data()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is an owner
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner can wipe ledger data';
    END IF;

    TRUNCATE TABLE public.payments, public.mortgages, public.customers, public.audit_logs CASCADE;
    ALTER SEQUENCE IF EXISTS public.mortgage_no_seq RESTART WITH 1001;
    ALTER SEQUENCE IF EXISTS public.receipt_no_seq RESTART WITH 5001;

    RETURN jsonb_build_object('success', true, 'message', 'All demo data wiped successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.wipe_demo_data TO authenticated;

-- Confirmation output
SELECT 'All demo data wiped successfully! Your ledger is now fresh, clean, and ready for real records.' AS status;
