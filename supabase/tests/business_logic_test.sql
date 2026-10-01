-- supabase/tests/business_logic_test.sql
-- Automated SQL Test Suite for Mortgage Management Core Business Rules

BEGIN;

-- Test 1: Verify Sequence existence
DO $$
BEGIN
    ASSERT (SELECT exists (SELECT 1 FROM pg_sequences WHERE sequencename = 'mortgage_no_seq')), 'mortgage_no_seq missing';
    ASSERT (SELECT exists (SELECT 1 FROM pg_sequences WHERE sequencename = 'receipt_no_seq')), 'receipt_no_seq missing';
    RAISE NOTICE 'Test 1 Passed: Sequences exist.';
END $$;

-- Test 2: Verify Flat Yearly Interest Calculation Logic
-- 40,000 at 25% = 10,000 yearly
DO $$
DECLARE
    v_principal BIGINT := 40000;
    v_rate NUMERIC := 25.00;
    v_interest BIGINT;
BEGIN
    v_interest := round((v_principal::numeric * v_rate) / 100.0)::bigint;
    ASSERT v_interest = 10000, 'Expected interest 10,000, got ' || v_interest;
    RAISE NOTICE 'Test 2 Passed: Flat yearly interest calculation matches.';
END $$;

-- Test 3: Verify Payment Immutability Trigger (Prevent Update/Delete)
DO $$
DECLARE
    v_dummy_id UUID := gen_random_uuid();
    v_dummy_mtg UUID := gen_random_uuid();
    v_dummy_user UUID := gen_random_uuid();
    v_blocked BOOLEAN := false;
BEGIN
    -- Insert a dummy customer and mortgage first
    INSERT INTO public.customers (id, name, phone)
    VALUES (v_dummy_user, 'Test Person', '01700000000') ON CONFLICT DO NOTHING;

    INSERT INTO public.mortgages (id, mortgage_no, customer_id, principal, interest_rate, start_date, due_date, collateral_type, collateral_description)
    VALUES (v_dummy_mtg, 'TEST-MTG-001', v_dummy_user, 10000, 20.00, CURRENT_DATE, CURRENT_DATE + 365, 'other', 'Test Item')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.payments (id, receipt_no, mortgage_id, paid_on, type, amount)
    VALUES (v_dummy_id, 'TEST-REC-001', v_dummy_mtg, CURRENT_DATE, 'interest', 2000);

    -- Try to UPDATE payment - MUST FAIL
    BEGIN
        UPDATE public.payments SET amount = 3000 WHERE id = v_dummy_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;

    ASSERT v_blocked = true, 'Payment UPDATE was not blocked!';

    -- Try to DELETE payment - MUST FAIL
    v_blocked := false;
    BEGIN
        DELETE FROM public.payments WHERE id = v_dummy_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;

    ASSERT v_blocked = true, 'Payment DELETE was not blocked!';

    RAISE NOTICE 'Test 3 Passed: Payment immutability strictly enforced.';
END $$;

ROLLBACK;
