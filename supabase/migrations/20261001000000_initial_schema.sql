-- 00001_initial_schema.sql
-- Production-ready Mortgage Management Database Schema
-- Currency: BDT (Stored as 64-bit BigInt)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SEQUENCES FOR HUMAN-FRIENDLY NUMBERS
CREATE SEQUENCE IF NOT EXISTS mortgage_no_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS receipt_no_seq START WITH 5001;

-- 3. PROFILES TABLE (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now())
);

-- 4. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    nid_no TEXT,
    photo_path TEXT,
    nid_photo_path TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now())
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_nid ON public.customers(nid_no);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers USING gin(to_tsvector('simple', name));

-- 5. MORTGAGES TABLE
CREATE TABLE IF NOT EXISTS public.mortgages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mortgage_no TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    principal BIGINT NOT NULL CHECK (principal > 0),
    interest_rate NUMERIC(5,2) NOT NULL DEFAULT 25.00 CHECK (interest_rate >= 0),
    start_date DATE NOT NULL DEFAULT (timezone('Asia/Dhaka', now()))::date,
    due_date DATE NOT NULL,
    collateral_type TEXT NOT NULL CHECK (collateral_type IN ('gold', 'land', 'vehicle', 'electronics', 'other')),
    collateral_description TEXT NOT NULL,
    collateral_photo_paths TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'defaulted')),
    closed_at TIMESTAMPTZ,
    collateral_returned_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now()),
    CONSTRAINT chk_mortgage_due_after_start CHECK (due_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_mortgages_customer ON public.mortgages(customer_id);
CREATE INDEX IF NOT EXISTS idx_mortgages_status_due ON public.mortgages(status, due_date);
CREATE INDEX IF NOT EXISTS idx_mortgages_mortgage_no ON public.mortgages(mortgage_no);

-- 6. PAYMENTS TABLE (Strictly Immutable, Corrections Only)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no TEXT NOT NULL UNIQUE,
    mortgage_id UUID NOT NULL REFERENCES public.mortgages(id) ON DELETE RESTRICT,
    paid_on DATE NOT NULL DEFAULT (timezone('Asia/Dhaka', now()))::date,
    type TEXT NOT NULL CHECK (type IN ('interest', 'full_payment', 'correction')),
    amount BIGINT NOT NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    note TEXT,
    original_payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now())
);

CREATE INDEX IF NOT EXISTS idx_payments_mortgage ON public.payments(mortgage_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt_no ON public.payments(receipt_no);
CREATE INDEX IF NOT EXISTS idx_payments_paid_on ON public.payments(paid_on);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Dhaka', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 8. NUMBER GENERATION HELPERS
CREATE OR REPLACE FUNCTION public.generate_mortgage_no()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    next_num BIGINT;
    year_prefix TEXT;
BEGIN
    SELECT nextval('mortgage_no_seq') INTO next_num;
    year_prefix := to_char(timezone('Asia/Dhaka', now()), 'YYYYMM');
    RETURN 'MTG-' || year_prefix || '-' || lpad(next_num::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_receipt_no()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    next_num BIGINT;
    year_prefix TEXT;
BEGIN
    SELECT nextval('receipt_no_seq') INTO next_num;
    year_prefix := to_char(timezone('Asia/Dhaka', now()), 'YYYYMM');
    RETURN 'REC-' || year_prefix || '-' || lpad(next_num::text, 4, '0');
END;
$$;

-- 9. PAYMENT IMMUTABILITY TRIGGER (Blocks any UPDATE or DELETE)
CREATE OR REPLACE FUNCTION public.prevent_payment_mutations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Payments are strictly immutable and cannot be updated or deleted. Use add_correction() instead.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_payment_mutations ON public.payments;
CREATE TRIGGER trg_block_payment_mutations
BEFORE UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_mutations();

-- 10. AUDIT LOG TRIGGER
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    curr_user_id UUID;
    rec_id UUID;
    old_val JSONB := NULL;
    new_val JSONB := NULL;
BEGIN
    curr_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        rec_id := NEW.id;
        new_val := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        rec_id := NEW.id;
        old_val := to_jsonb(OLD);
        new_val := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        rec_id := OLD.id;
        old_val := to_jsonb(OLD);
    END IF;

    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (curr_user_id, TG_OP, TG_TABLE_NAME, rec_id, old_val, new_val);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Attach audit trigger to relevant tables
DROP TRIGGER IF EXISTS trg_audit_customers ON public.customers;
CREATE TRIGGER trg_audit_customers
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_mortgages ON public.mortgages;
CREATE TRIGGER trg_audit_mortgages
AFTER INSERT OR UPDATE OR DELETE ON public.mortgages
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 11. AUTOMATIC PROFILE ON SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    user_count INT;
    assigned_role TEXT;
    user_full_name TEXT;
    user_phone TEXT;
BEGIN
    SELECT count(*) INTO user_count FROM public.profiles;
    -- First created user is always owner, subsequent are staff by default
    IF user_count = 0 THEN
        assigned_role := 'owner';
    ELSE
        assigned_role := coalesce(NEW.raw_user_meta_data->>'role', 'staff');
    END IF;

    user_full_name := coalesce(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        'User'
    );
    user_phone := coalesce(NEW.phone, NEW.raw_user_meta_data->>'phone', NULL);

    INSERT INTO public.profiles (id, name, role, phone, is_active)
    VALUES (NEW.id, user_full_name, assigned_role, user_phone, true)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = coalesce(EXCLUDED.phone, public.profiles.phone);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. HELPER FUNCTIONS FOR SECURITY & ROLES
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT coalesce(
        (SELECT role = 'owner' FROM public.profiles WHERE id = auth.uid() AND is_active = true),
        false
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff_or_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT coalesce(
        (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
        false
    );
$$;

-- 13. POSTGRES FUNCTIONS (RPC) WITH ALL BUSINESS LOGIC

-- RPC 1: CREATE MORTGAGE
CREATE OR REPLACE FUNCTION public.create_mortgage(
    p_customer_id UUID,
    p_principal BIGINT,
    p_interest_rate NUMERIC,
    p_collateral_type TEXT,
    p_collateral_description TEXT,
    p_collateral_photo_paths TEXT[] DEFAULT '{}',
    p_start_date DATE DEFAULT NULL,
    p_due_date DATE DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start DATE;
    v_due DATE;
    v_mortgage_no TEXT;
    v_mortgage RECORD;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_active_staff_or_owner() THEN
        RAISE EXCEPTION 'Permission denied: User is inactive or unauthorized';
    END IF;

    IF p_principal <= 0 THEN
        RAISE EXCEPTION 'Principal amount must be greater than 0';
    END IF;

    IF p_interest_rate < 0 THEN
        RAISE EXCEPTION 'Interest rate cannot be negative';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    v_start := coalesce(p_start_date, (timezone('Asia/Dhaka', now()))::date);
    -- 1-year term by default
    v_due := coalesce(p_due_date, (v_start + INTERVAL '1 year')::date);
    v_mortgage_no := public.generate_mortgage_no();

    INSERT INTO public.mortgages (
        mortgage_no,
        customer_id,
        principal,
        interest_rate,
        start_date,
        due_date,
        collateral_type,
        collateral_description,
        collateral_photo_paths,
        status,
        created_by
    ) VALUES (
        v_mortgage_no,
        p_customer_id,
        p_principal,
        p_interest_rate,
        v_start,
        v_due,
        p_collateral_type,
        p_collateral_description,
        coalesce(p_collateral_photo_paths, '{}'),
        'active',
        v_user_id
    ) RETURNING * INTO v_mortgage;

    RETURN to_jsonb(v_mortgage);
END;
$$;

-- RPC 2: RENEW MORTGAGE
-- Pays only interest: (principal * rate / 100). Principal stays, due_date moves +1 year.
CREATE OR REPLACE FUNCTION public.renew_mortgage(
    p_mortgage_id UUID,
    p_paid_on DATE DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_mortgage RECORD;
    v_interest_amount BIGINT;
    v_receipt_no TEXT;
    v_payment RECORD;
    v_new_due_date DATE;
    v_user_id UUID;
    v_payment_date DATE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_active_staff_or_owner() THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    SELECT * INTO v_mortgage FROM public.mortgages WHERE id = p_mortgage_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mortgage record not found';
    END IF;

    IF v_mortgage.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot renew mortgage with status %', v_mortgage.status;
    END IF;

    -- Interest is flat per year on the original principal
    v_interest_amount := round((v_mortgage.principal::numeric * v_mortgage.interest_rate) / 100.0)::bigint;
    v_new_due_date := (v_mortgage.due_date + INTERVAL '1 year')::date;
    v_payment_date := coalesce(p_paid_on, (timezone('Asia/Dhaka', now()))::date);
    v_receipt_no := public.generate_receipt_no();

    -- Insert payment
    INSERT INTO public.payments (
        receipt_no,
        mortgage_id,
        paid_on,
        type,
        amount,
        received_by,
        note
    ) VALUES (
        v_receipt_no,
        p_mortgage_id,
        v_payment_date,
        'interest',
        v_interest_amount,
        v_user_id,
        coalesce(p_note, 'Yearly renewal interest payment')
    ) RETURNING * INTO v_payment;

    -- Update mortgage due_date
    UPDATE public.mortgages
    SET due_date = v_new_due_date,
        updated_at = timezone('Asia/Dhaka', now())
    WHERE id = p_mortgage_id;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'renew',
        'mortgage_id', p_mortgage_id,
        'payment_id', v_payment.id,
        'receipt_no', v_receipt_no,
        'amount', v_interest_amount,
        'previous_due_date', v_mortgage.due_date,
        'new_due_date', v_new_due_date
    );
END;
$$;

-- RPC 3: CLOSE MORTGAGE
-- Pays principal + interest. Mortgage closed, collateral returned.
CREATE OR REPLACE FUNCTION public.close_mortgage(
    p_mortgage_id UUID,
    p_paid_on DATE DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_mortgage RECORD;
    v_interest_amount BIGINT;
    v_total_amount BIGINT;
    v_receipt_no TEXT;
    v_payment RECORD;
    v_user_id UUID;
    v_payment_date DATE;
    v_now TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_active_staff_or_owner() THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    SELECT * INTO v_mortgage FROM public.mortgages WHERE id = p_mortgage_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mortgage record not found';
    END IF;

    IF v_mortgage.status <> 'active' THEN
        RAISE EXCEPTION 'Mortgage is already %', v_mortgage.status;
    END IF;

    v_interest_amount := round((v_mortgage.principal::numeric * v_mortgage.interest_rate) / 100.0)::bigint;
    v_total_amount := v_mortgage.principal + v_interest_amount;
    v_payment_date := coalesce(p_paid_on, (timezone('Asia/Dhaka', now()))::date);
    v_now := timezone('Asia/Dhaka', now());
    v_receipt_no := public.generate_receipt_no();

    -- Insert full payment
    INSERT INTO public.payments (
        receipt_no,
        mortgage_id,
        paid_on,
        type,
        amount,
        received_by,
        note
    ) VALUES (
        v_receipt_no,
        p_mortgage_id,
        v_payment_date,
        'full_payment',
        v_total_amount,
        v_user_id,
        coalesce(p_note, 'Principal + Interest full settlement for mortgage closure')
    ) RETURNING * INTO v_payment;

    -- Close mortgage & mark collateral returned
    UPDATE public.mortgages
    SET status = 'closed',
        closed_at = v_now,
        collateral_returned_at = v_now,
        updated_at = v_now
    WHERE id = p_mortgage_id;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'close',
        'mortgage_id', p_mortgage_id,
        'payment_id', v_payment.id,
        'receipt_no', v_receipt_no,
        'principal', v_mortgage.principal,
        'interest', v_interest_amount,
        'total_amount', v_total_amount,
        'closed_at', v_now
    );
END;
$$;

-- RPC 4: ADD CORRECTION (Reversal Entry)
CREATE OR REPLACE FUNCTION public.add_correction(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_orig_payment RECORD;
    v_mortgage RECORD;
    v_reversal_receipt_no TEXT;
    v_reversal_payment RECORD;
    v_user_id UUID;
    v_already_corrected BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_active_staff_or_owner() THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid correction reason is required';
    END IF;

    SELECT * INTO v_orig_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found';
    END IF;

    IF v_orig_payment.type = 'correction' THEN
        RAISE EXCEPTION 'Cannot reverse a correction entry';
    END IF;

    -- Check if already reversed
    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE original_payment_id = p_payment_id
    ) INTO v_already_corrected;

    IF v_already_corrected THEN
        RAISE EXCEPTION 'This payment has already been reversed with a correction entry';
    END IF;

    SELECT * INTO v_mortgage FROM public.mortgages WHERE id = v_orig_payment.mortgage_id FOR UPDATE;

    v_reversal_receipt_no := public.generate_receipt_no();

    -- Insert negative reversal payment
    INSERT INTO public.payments (
        receipt_no,
        mortgage_id,
        paid_on,
        type,
        amount,
        received_by,
        note,
        original_payment_id
    ) VALUES (
        v_reversal_receipt_no,
        v_orig_payment.mortgage_id,
        (timezone('Asia/Dhaka', now()))::date,
        'correction',
        -v_orig_payment.amount,
        v_user_id,
        'REVERSAL of ' || v_orig_payment.receipt_no || ': ' || p_reason,
        p_payment_id
    ) RETURNING * INTO v_reversal_payment;

    -- If reversing a close payment, reopen the mortgage
    IF v_orig_payment.type = 'full_payment' AND v_mortgage.status = 'closed' THEN
        UPDATE public.mortgages
        SET status = 'active',
            closed_at = NULL,
            collateral_returned_at = NULL,
            updated_at = timezone('Asia/Dhaka', now())
        WHERE id = v_orig_payment.mortgage_id;
    END IF;

    -- If reversing an interest renewal payment, pull due_date back 1 year
    IF v_orig_payment.type = 'interest' THEN
        UPDATE public.mortgages
        SET due_date = (due_date - INTERVAL '1 year')::date,
            updated_at = timezone('Asia/Dhaka', now())
        WHERE id = v_orig_payment.mortgage_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'correction',
        'original_payment_id', p_payment_id,
        'correction_payment_id', v_reversal_payment.id,
        'receipt_no', v_reversal_receipt_no,
        'reversal_amount', -v_orig_payment.amount
    );
END;
$$;

-- RPC 5: DASHBOARD STATS
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_today DATE;
    v_month_start DATE;
    v_month_end DATE;
    v_year_start DATE;
    v_year_end DATE;
    v_total_outstanding BIGINT := 0;
    v_active_count BIGINT := 0;
    v_expected_interest_this_month BIGINT := 0;
    v_overdue_count BIGINT := 0;
    v_due_15_days_count BIGINT := 0;
    v_income_month BIGINT := 0;
    v_income_year BIGINT := 0;
BEGIN
    IF NOT public.is_active_staff_or_owner() THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    v_today := (timezone('Asia/Dhaka', now()))::date;
    v_month_start := date_trunc('month', v_today)::date;
    v_month_end := (date_trunc('month', v_today) + INTERVAL '1 month')::date;
    v_year_start := date_trunc('year', v_today)::date;
    v_year_end := (date_trunc('year', v_today) + INTERVAL '1 year')::date;

    -- 1. Outstanding principal & active count
    SELECT
        coalesce(sum(principal), 0),
        count(*)
    INTO v_total_outstanding, v_active_count
    FROM public.mortgages
    WHERE status = 'active';

    -- 2. Expected interest this month on active mortgages due this month
    SELECT
        coalesce(sum(round((principal::numeric * interest_rate) / 100.0)), 0)
    INTO v_expected_interest_this_month
    FROM public.mortgages
    WHERE status = 'active'
      AND due_date >= v_month_start
      AND due_date < v_month_end;

    -- 3. Overdue count (due_date < today AND status = 'active')
    SELECT count(*)
    INTO v_overdue_count
    FROM public.mortgages
    WHERE status = 'active'
      AND due_date < v_today;

    -- 4. Due within 15 days (today <= due_date <= today + 15)
    SELECT count(*)
    INTO v_due_15_days_count
    FROM public.mortgages
    WHERE status = 'active'
      AND due_date >= v_today
      AND due_date <= (v_today + 15);

    -- 5. Income this month (sum of payments)
    SELECT coalesce(sum(amount), 0)
    INTO v_income_month
    FROM public.payments
    WHERE paid_on >= v_month_start
      AND paid_on < v_month_end;

    -- 6. Income this year
    SELECT coalesce(sum(amount), 0)
    INTO v_income_year
    FROM public.payments
    WHERE paid_on >= v_year_start
      AND paid_on < v_year_end;

    RETURN jsonb_build_object(
        'total_outstanding_principal', v_total_outstanding,
        'active_mortgages_count', v_active_count,
        'expected_interest_this_month', v_expected_interest_this_month,
        'overdue_count', v_overdue_count,
        'due_within_15_days_count', v_due_15_days_count,
        'income_this_month', v_income_month,
        'income_this_year', v_income_year,
        'calculated_at', timezone('Asia/Dhaka', now())
    );
END;
$$;

-- 14. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortgages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_active_staff" ON public.profiles;
CREATE POLICY "profiles_select_active_staff" ON public.profiles
FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
        id = auth.uid() OR
        public.is_active_staff_or_owner()
    )
);

DROP POLICY IF EXISTS "profiles_update_owner_or_self" ON public.profiles;
CREATE POLICY "profiles_update_owner_or_self" ON public.profiles
FOR UPDATE USING (
    public.is_owner() OR (
        id = auth.uid() AND
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Prevents self role escalation
    )
);

DROP POLICY IF EXISTS "profiles_insert_owner" ON public.profiles;
CREATE POLICY "profiles_insert_owner" ON public.profiles
FOR INSERT WITH CHECK (
    public.is_owner() OR auth.uid() = id
);

-- CUSTOMERS POLICIES
DROP POLICY IF EXISTS "customers_select_staff_owner" ON public.customers;
CREATE POLICY "customers_select_staff_owner" ON public.customers
FOR SELECT USING (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "customers_insert_staff_owner" ON public.customers;
CREATE POLICY "customers_insert_staff_owner" ON public.customers
FOR INSERT WITH CHECK (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "customers_update_staff_owner" ON public.customers;
CREATE POLICY "customers_update_staff_owner" ON public.customers
FOR UPDATE USING (public.is_active_staff_or_owner())
WITH CHECK (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "customers_delete_owner_only" ON public.customers;
CREATE POLICY "customers_delete_owner_only" ON public.customers
FOR DELETE USING (public.is_owner());

-- MORTGAGES POLICIES
DROP POLICY IF EXISTS "mortgages_select_staff_owner" ON public.mortgages;
CREATE POLICY "mortgages_select_staff_owner" ON public.mortgages
FOR SELECT USING (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "mortgages_insert_staff_owner" ON public.mortgages;
CREATE POLICY "mortgages_insert_staff_owner" ON public.mortgages
FOR INSERT WITH CHECK (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "mortgages_update_staff_owner" ON public.mortgages;
CREATE POLICY "mortgages_update_staff_owner" ON public.mortgages
FOR UPDATE USING (public.is_active_staff_or_owner())
WITH CHECK (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "mortgages_delete_owner_only" ON public.mortgages;
CREATE POLICY "mortgages_delete_owner_only" ON public.mortgages
FOR DELETE USING (
    public.is_owner() AND
    NOT EXISTS (SELECT 1 FROM public.payments WHERE mortgage_id = public.mortgages.id)
);

-- PAYMENTS POLICIES (INSERT and SELECT only; UPDATE and DELETE completely forbidden)
DROP POLICY IF EXISTS "payments_select_staff_owner" ON public.payments;
CREATE POLICY "payments_select_staff_owner" ON public.payments
FOR SELECT USING (public.is_active_staff_or_owner());

DROP POLICY IF EXISTS "payments_insert_staff_owner" ON public.payments;
CREATE POLICY "payments_insert_staff_owner" ON public.payments
FOR INSERT WITH CHECK (public.is_active_staff_or_owner());

-- AUDIT LOGS POLICIES (Owner only can select, nobody can mutate directly)
DROP POLICY IF EXISTS "audit_logs_select_owner_only" ON public.audit_logs;
CREATE POLICY "audit_logs_select_owner_only" ON public.audit_logs
FOR SELECT USING (public.is_owner());

-- 15. STORAGE BUCKETS SETUP (Private Buckets accessed via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('customer-photos', 'customer-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('nid-docs', 'nid-docs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('collateral-photos', 'collateral-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies for authenticated staff/owner
DROP POLICY IF EXISTS "Staff and Owner can read storage objects" ON storage.objects;
CREATE POLICY "Staff and Owner can read storage objects" ON storage.objects
FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id IN ('customer-photos', 'nid-docs', 'collateral-photos')
);

DROP POLICY IF EXISTS "Staff and Owner can upload storage objects" ON storage.objects;
CREATE POLICY "Staff and Owner can upload storage objects" ON storage.objects
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id IN ('customer-photos', 'nid-docs', 'collateral-photos')
);

DROP POLICY IF EXISTS "Owner can delete storage objects" ON storage.objects;
CREATE POLICY "Owner can delete storage objects" ON storage.objects
FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id IN ('customer-photos', 'nid-docs', 'collateral-photos') AND
    public.is_owner()
);
