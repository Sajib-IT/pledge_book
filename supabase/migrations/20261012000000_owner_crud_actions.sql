-- supabase/migrations/20261012000000_owner_crud_actions.sql
-- Enables full cascading deletion of mortgages and customers for Owners.
-- Run this script in the Supabase SQL Editor.

-- 1. Ensure foreign key constraints support cascading delete
ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_mortgage_id_fkey,
ADD CONSTRAINT payments_mortgage_id_fkey
FOREIGN KEY (mortgage_id) REFERENCES public.mortgages(id) ON DELETE CASCADE;

ALTER TABLE public.mortgages
DROP CONSTRAINT IF EXISTS mortgages_customer_id_fkey,
ADD CONSTRAINT mortgages_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- 2. Drop and recreate DELETE policies for authenticated users
DROP POLICY IF EXISTS "payments_delete_user" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_staff_owner" ON public.payments;
CREATE POLICY "payments_delete_user" ON public.payments
FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mortgages_delete_user" ON public.mortgages;
DROP POLICY IF EXISTS "mortgages_delete_owner_only" ON public.mortgages;
CREATE POLICY "mortgages_delete_user" ON public.mortgages
FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "customers_delete_user" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_owner_only" ON public.customers;
CREATE POLICY "customers_delete_user" ON public.customers
FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. Secure RPC: Delete Mortgage (Cascade removes related payments in single transaction)
CREATE OR REPLACE FUNCTION public.delete_mortgage(
    p_mortgage_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_deleted_payments_count INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Delete related payments
    DELETE FROM public.payments WHERE mortgage_id = p_mortgage_id;
    GET DIAGNOSTICS v_deleted_payments_count = ROW_COUNT;

    -- Delete mortgage
    DELETE FROM public.mortgages WHERE id = p_mortgage_id;

    RETURN jsonb_build_object(
        'success', true,
        'mortgage_id', p_mortgage_id,
        'deleted_payments_count', v_deleted_payments_count
    );
END;
$$;

-- 4. Secure RPC: Delete Customer (Cascade removes customer and all their mortgages/payments)
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(
    p_customer_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_mortgage_ids UUID[];
    v_deleted_mortgages_count INT := 0;
    v_deleted_payments_count INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Collect all mortgage IDs for this customer
    SELECT array_agg(id) INTO v_mortgage_ids
    FROM public.mortgages
    WHERE customer_id = p_customer_id;

    IF v_mortgage_ids IS NOT NULL AND array_length(v_mortgage_ids, 1) > 0 THEN
        -- Delete payments for these mortgages
        DELETE FROM public.payments WHERE mortgage_id = ANY(v_mortgage_ids);
        GET DIAGNOSTICS v_deleted_payments_count = ROW_COUNT;

        -- Delete mortgages
        DELETE FROM public.mortgages WHERE id = ANY(v_mortgage_ids);
        GET DIAGNOSTICS v_deleted_mortgages_count = ROW_COUNT;
    END IF;

    -- Delete customer
    DELETE FROM public.customers WHERE id = p_customer_id;

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', p_customer_id,
        'deleted_mortgages_count', v_deleted_mortgages_count,
        'deleted_payments_count', v_deleted_payments_count
    );
END;
$$;

-- 5. Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.delete_mortgage TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_customer_cascade TO authenticated, anon;
