-- 20261001000001_early_repayment_and_discounts.sql
-- Enables Early Repayment, Pro-Rata Interest calculation, and Discounts/Underpayment handling in RPCs

-- 1. DROP EXISTING OVERLOADS TO PREVENT AMBIGUITY
DROP FUNCTION IF EXISTS public.renew_mortgage(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.renew_mortgage(UUID, DATE, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.close_mortgage(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.close_mortgage(UUID, DATE, TEXT, BIGINT);

-- 2. UPDATED RENEW RPC (Accepts custom / discounted amount)
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

    -- If custom amount provided (e.g. with discount or custom waiver), use it; otherwise flat yearly interest
    IF p_amount IS NOT NULL AND p_amount > 0 THEN
        v_interest_amount := p_amount;
    ELSE
        v_interest_amount := round((v_mortgage.principal::numeric * v_mortgage.interest_rate) / 100.0)::bigint;
    END IF;

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

-- 3. UPDATED CLOSE RPC (Supports Early Repayments, Pro-Rata amounts, and Discounts)
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

    -- If custom/discounted amount provided, use it; otherwise compute default principal + 1-year interest
    IF p_amount IS NOT NULL AND p_amount > 0 THEN
        v_total_amount := p_amount;
    ELSE
        v_interest_amount := round((v_mortgage.principal::numeric * v_mortgage.interest_rate) / 100.0)::bigint;
        v_total_amount := v_mortgage.principal + v_interest_amount;
    END IF;

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
        'amount', v_total_amount,
        'closed_at', v_now
    );
END;
$$;
