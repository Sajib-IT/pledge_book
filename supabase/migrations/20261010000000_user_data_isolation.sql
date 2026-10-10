-- 20261010000000_user_data_isolation.sql
-- Multi-Tenancy & Data Isolation: Restrict customers, mortgages, payments and statistics strictly per user/owner.
-- Prevents any user from seeing or modifying another user's customers, mortgages, or financial records.

-- 1. DROP EXISTING SHARED RLS POLICIES
DROP POLICY IF EXISTS "customers_select_staff_owner" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_staff_owner" ON public.customers;
DROP POLICY IF EXISTS "customers_update_staff_owner" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_owner_only" ON public.customers;
DROP POLICY IF EXISTS "customers_select_user" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_user" ON public.customers;
DROP POLICY IF EXISTS "customers_update_user" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_user" ON public.customers;

DROP POLICY IF EXISTS "mortgages_select_staff_owner" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_insert_staff_owner" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_update_staff_owner" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_delete_owner_only" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_select_user" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_insert_user" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_update_user" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_delete_user" ON public.mortgages;

DROP POLICY IF EXISTS "payments_select_staff_owner" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_staff_owner" ON public.payments;
DROP POLICY IF EXISTS "payments_select_user" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_user" ON public.payments;

-- 2. CREATE STRICT USER-ISOLATED POLICIES FOR CUSTOMERS
CREATE POLICY "customers_select_user" ON public.customers
FOR SELECT USING (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

CREATE POLICY "customers_insert_user" ON public.customers
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

CREATE POLICY "customers_update_user" ON public.customers
FOR UPDATE USING (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
) WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

CREATE POLICY "customers_delete_user" ON public.customers
FOR DELETE USING (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

-- 3. CREATE STRICT USER-ISOLATED POLICIES FOR MORTGAGES
CREATE POLICY "mortgages_select_user" ON public.mortgages
FOR SELECT USING (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

CREATE POLICY "mortgages_insert_user" ON public.mortgages
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

CREATE POLICY "mortgages_update_user" ON public.mortgages
FOR UPDATE USING (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
) WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
);

CREATE POLICY "mortgages_delete_user" ON public.mortgages
FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    created_by = auth.uid() AND
    NOT EXISTS (SELECT 1 FROM public.payments WHERE mortgage_id = public.mortgages.id)
);

-- 4. CREATE STRICT USER-ISOLATED POLICIES FOR PAYMENTS
CREATE POLICY "payments_select_user" ON public.payments
FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM public.mortgages m
        WHERE m.id = payments.mortgage_id AND m.created_by = auth.uid()
    )
);

CREATE POLICY "payments_insert_user" ON public.payments
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM public.mortgages m
        WHERE m.id = payments.mortgage_id AND m.created_by = auth.uid()
    )
);

-- 5. SECURE RPC: CREATE MORTGAGE (Scoping Customer and Mortgage to auth.uid())
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

    IF p_principal <= 0 THEN
        RAISE EXCEPTION 'Principal amount must be greater than 0';
    END IF;

    IF p_interest_rate < 0 THEN
        RAISE EXCEPTION 'Interest rate cannot be negative';
    END IF;

    -- Verify that the customer exists and belongs to THIS user
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND created_by = v_user_id) THEN
        RAISE EXCEPTION 'Customer not found or unauthorized';
    END IF;

    v_start := coalesce(p_start_date, (timezone('Asia/Dhaka', now()))::date);
    -- Default to 1 year if not provided, otherwise respect customer's agreed term
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

-- 6. SECURE RPC: RENEW MORTGAGE (Scoped to Mortgage Owner)
CREATE OR REPLACE FUNCTION public.renew_mortgage(
    p_mortgage_id UUID,
    p_paid_on DATE DEFAULT NULL,
    p_note TEXT DEFAULT NULL,
    p_amount BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_mortgage RECORD;
    v_interest_amount BIGINT;
    v_new_due_date DATE;
    v_receipt_no TEXT;
    v_payment RECORD;
    v_user_id UUID;
    v_payment_date DATE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Strictly ensure mortgage belongs to this user
    SELECT * INTO v_mortgage FROM public.mortgages
    WHERE id = p_mortgage_id AND created_by = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mortgage record not found or unauthorized';
    END IF;

    IF v_mortgage.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot renew mortgage with status %', v_mortgage.status;
    END IF;

    IF p_amount IS NOT NULL AND p_amount > 0 THEN
        v_interest_amount := p_amount;
    ELSE
        v_interest_amount := round((v_mortgage.principal::numeric * v_mortgage.interest_rate) / 100.0)::bigint;
    END IF;

    v_new_due_date := (v_mortgage.due_date + INTERVAL '1 year')::date;
    v_payment_date := coalesce(p_paid_on, (timezone('Asia/Dhaka', now()))::date);
    v_receipt_no := public.generate_receipt_no();

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
        coalesce(p_note, 'Renewal interest payment')
    ) RETURNING * INTO v_payment;

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

-- 7. SECURE RPC: CLOSE MORTGAGE (Scoped to Mortgage Owner)
CREATE OR REPLACE FUNCTION public.close_mortgage(
    p_mortgage_id UUID,
    p_paid_on DATE DEFAULT NULL,
    p_note TEXT DEFAULT NULL,
    p_amount BIGINT DEFAULT NULL
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

    -- Strictly ensure mortgage belongs to this user
    SELECT * INTO v_mortgage FROM public.mortgages
    WHERE id = p_mortgage_id AND created_by = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mortgage record not found or unauthorized';
    END IF;

    IF v_mortgage.status <> 'active' THEN
        RAISE EXCEPTION 'Mortgage is already %', v_mortgage.status;
    END IF;

    IF p_amount IS NOT NULL AND p_amount > 0 THEN
        v_total_amount := p_amount;
    ELSE
        v_interest_amount := round((v_mortgage.principal::numeric * v_mortgage.interest_rate) / 100.0)::bigint;
        v_total_amount := v_mortgage.principal + v_interest_amount;
    END IF;

    v_payment_date := coalesce(p_paid_on, (timezone('Asia/Dhaka', now()))::date);
    v_now := timezone('Asia/Dhaka', now());
    v_receipt_no := public.generate_receipt_no();

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
        'amount', v_total_amount,
        'closed_at', v_now
    );
END;
$$;

-- 8. SECURE RPC: ADD CORRECTION (Scoped to User's Mortgage)
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

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid correction reason is required';
    END IF;

    SELECT * INTO v_orig_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found';
    END IF;

    -- Verify that the mortgage belongs to the authenticated user
    SELECT * INTO v_mortgage FROM public.mortgages
    WHERE id = v_orig_payment.mortgage_id AND created_by = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized to reverse this payment';
    END IF;

    IF v_orig_payment.type = 'correction' THEN
        RAISE EXCEPTION 'Cannot reverse a correction entry';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE original_payment_id = p_payment_id
    ) INTO v_already_corrected;

    IF v_already_corrected THEN
        RAISE EXCEPTION 'This payment has already been reversed with a correction entry';
    END IF;

    v_reversal_receipt_no := public.generate_receipt_no();

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

    IF v_orig_payment.type = 'full_payment' AND v_mortgage.status = 'closed' THEN
        UPDATE public.mortgages
        SET status = 'active',
            closed_at = NULL,
            collateral_returned_at = NULL,
            updated_at = timezone('Asia/Dhaka', now())
        WHERE id = v_orig_payment.mortgage_id;
    END IF;

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

-- 9. SECURE RPC: DASHBOARD STATS (Aggregated Strictly Per User)
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_today := (timezone('Asia/Dhaka', now()))::date;
    v_month_start := date_trunc('month', v_today)::date;
    v_month_end := (date_trunc('month', v_today) + INTERVAL '1 month')::date;
    v_year_start := date_trunc('year', v_today)::date;
    v_year_end := (date_trunc('year', v_today) + INTERVAL '1 year')::date;

    -- 1. Outstanding principal & active count strictly scoped to calling user
    SELECT
        coalesce(sum(principal), 0),
        count(*)
    INTO v_total_outstanding, v_active_count
    FROM public.mortgages
    WHERE status = 'active'
      AND created_by = v_user_id;

    -- 2. Expected interest this month on active mortgages strictly scoped to calling user
    SELECT
        coalesce(sum(round((principal::numeric * interest_rate) / 100.0)), 0)
    INTO v_expected_interest_this_month
    FROM public.mortgages
    WHERE status = 'active'
      AND created_by = v_user_id
      AND due_date >= v_month_start
      AND due_date < v_month_end;

    -- 3. Overdue count strictly scoped to calling user
    SELECT count(*)
    INTO v_overdue_count
    FROM public.mortgages
    WHERE status = 'active'
      AND created_by = v_user_id
      AND due_date < v_today;

    -- 4. Due within 15 days strictly scoped to calling user
    SELECT count(*)
    INTO v_due_15_days_count
    FROM public.mortgages
    WHERE status = 'active'
      AND created_by = v_user_id
      AND due_date >= v_today
      AND due_date <= (v_today + 15);

    -- 5. Income this month strictly scoped to calling user's mortgages
    SELECT coalesce(sum(p.amount), 0)
    INTO v_income_month
    FROM public.payments p
    JOIN public.mortgages m ON m.id = p.mortgage_id
    WHERE m.created_by = v_user_id
      AND p.paid_on >= v_month_start
      AND p.paid_on < v_month_end;

    -- 6. Income this year strictly scoped to calling user's mortgages
    SELECT coalesce(sum(p.amount), 0)
    INTO v_income_year
    FROM public.payments p
    JOIN public.mortgages m ON m.id = p.mortgage_id
    WHERE m.created_by = v_user_id
      AND p.paid_on >= v_year_start
      AND p.paid_on < v_year_end;

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
