-- supabase/seed.sql
-- Production Seed Data for PledgeBook (Mortgage Management - Bangladesh)
-- Safe, idempotent, dynamically links to your active owner user

DO $$
DECLARE
    v_owner_id UUID;
    v_staff_id UUID;
    v_cust_rahim UUID := '10000000-0000-0000-0000-000000000001'::uuid;
    v_cust_karim UUID := '10000000-0000-0000-0000-000000000002'::uuid;
    v_cust_fatima UUID := '10000000-0000-0000-0000-000000000003'::uuid;
    v_cust_anwar UUID := '10000000-0000-0000-0000-000000000004'::uuid;
    v_cust_selim UUID := '10000000-0000-0000-0000-000000000005'::uuid;

    v_mtg_1 UUID := '20000000-0000-0000-0000-000000000001'::uuid;
    v_mtg_2 UUID := '20000000-0000-0000-0000-000000000002'::uuid;
    v_mtg_3 UUID := '20000000-0000-0000-0000-000000000003'::uuid;
    v_mtg_4 UUID := '20000000-0000-0000-0000-000000000004'::uuid;
    v_mtg_5 UUID := '20000000-0000-0000-0000-000000000005'::uuid;
BEGIN
    -- 1. Find the owner user (prefer ashiksajib19@gmail.com or first auth user)
    SELECT id INTO v_owner_id FROM auth.users WHERE email = 'ashiksajib19@gmail.com' LIMIT 1;
    IF v_owner_id IS NULL THEN
        SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- If no auth user exists yet, raise notice
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'No user found in auth.users. Please create or confirm your account first!';
    END IF;

    -- Staff ID can default to owner or staff account if present
    SELECT id INTO v_staff_id FROM auth.users WHERE email = 'staff@pledgebook.com' LIMIT 1;
    IF v_staff_id IS NULL THEN
        v_staff_id := v_owner_id;
    END IF;

    -- 2. Ensure owner profile exists and has owner role
    INSERT INTO public.profiles (id, name, role, phone, is_active)
    VALUES (v_owner_id, 'Ashik Sajib (Owner)', 'owner', '01711000001', true)
    ON CONFLICT (id) DO UPDATE SET 
        role = 'owner',
        name = COALESCE(public.profiles.name, 'Ashik Sajib');

    IF v_staff_id <> v_owner_id THEN
        INSERT INTO public.profiles (id, name, role, phone, is_active)
        VALUES (v_staff_id, 'Tanvir Ahmed (Manager)', 'staff', '01812000002', true)
        ON CONFLICT (id) DO UPDATE SET role = 'staff';
    END IF;

    -- 3. Insert Demo Customers (Realistic Bangladeshi Pawn/Mortgage clients)
    INSERT INTO public.customers (id, name, phone, address, nid_no, notes, created_by)
    VALUES 
        (
            v_cust_rahim,
            'Abdur Rahim (আব্দুর রহিম)',
            '01711223344',
            'House 12, Road 4, Sector 7, Uttara, Dhaka',
            '19852691234567890',
            'Regular customer. Wholesaler in Kawran Bazar.',
            v_owner_id
        ),
        (
            v_cust_karim,
            'Karim Mia (করিম মিয়া)',
            '01819887766',
            'Gram: Rasulpur, Thana: Gazipur Sadar, Gazipur',
            '19903314567890123',
            'Dairy & poultry farmer. Reliable family.',
            v_staff_id
        ),
        (
            v_cust_fatima,
            'Fatima Begum (ফাতেমা বেগম)',
            '01912334455',
            'Flat 3B, Masterpara, Mirpur-10, Dhaka',
            '19922619876543210',
            'High school headmistress.',
            v_staff_id
        ),
        (
            v_cust_anwar,
            'Anwar Hossain (আনোয়ার হোসেন)',
            '01615556677',
            'Holding 45, Station Road, Tongi, Gazipur',
            '19882699988776655',
            'Transport business operator.',
            v_owner_id
        ),
        (
            v_cust_selim,
            'Selim Reza (সেলিম রেজা)',
            '01725554433',
            'Road 9A, Dhanmondi R/A, Dhaka',
            '19872611223344556',
            'Textile merchant. High-value gold collateral.',
            v_owner_id
        )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        nid_no = EXCLUDED.nid_no,
        notes = EXCLUDED.notes;

    -- 4. Mortgage 1: ACTIVE (Gold Jewelry) - Due in 10 days (Displays in 'Due Soon' alert)
    INSERT INTO public.mortgages (
        id, mortgage_no, customer_id, principal, interest_rate, start_date, due_date,
        collateral_type, collateral_description, collateral_photo_paths, status, created_by
    ) VALUES (
        v_mtg_1,
        'MTG-202510-1001',
        v_cust_rahim,
        50000, -- 50,000 BDT
        25.00, -- 25% yearly => 12,500 interest
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '355 days')::date,
        ((timezone('Asia/Dhaka', now()))::date + INTERVAL '10 days')::date,
        'gold',
        '22 Karat Gold Necklace and 2 Bangles, Approx 24.5 grams with hallmark certificate.',
        '{}',
        'active',
        v_owner_id
    ) ON CONFLICT (id) DO NOTHING;

    -- 5. Mortgage 2: OVERDUE (Motorbike) - Due 20 days ago (Displays in 'Overdue' alert with 1-click WhatsApp reminder)
    INSERT INTO public.mortgages (
        id, mortgage_no, customer_id, principal, interest_rate, start_date, due_date,
        collateral_type, collateral_description, collateral_photo_paths, status, created_by
    ) VALUES (
        v_mtg_2,
        'MTG-202509-1002',
        v_cust_karim,
        40000, -- 40,000 BDT
        25.00, -- 25% yearly => 10,000 interest
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '385 days')::date,
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '20 days')::date,
        'vehicle',
        'Hero Splendor Plus 100cc (Dhaka Metro-Ha-11-2233) with original Blue Book & Tax Token.',
        '{}',
        'active',
        v_staff_id
    ) ON CONFLICT (id) DO NOTHING;

    -- 6. Mortgage 3: RENEWED (Land Deed) - Interest paid, due date extended 1 year
    INSERT INTO public.mortgages (
        id, mortgage_no, customer_id, principal, interest_rate, start_date, due_date,
        collateral_type, collateral_description, collateral_photo_paths, status, created_by
    ) VALUES (
        v_mtg_3,
        'MTG-202410-1003',
        v_cust_fatima,
        100000, -- 100,000 BDT
        24.00,  -- 24% yearly => 24,000 interest
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '370 days')::date,
        ((timezone('Asia/Dhaka', now()))::date + INTERVAL '360 days')::date,
        'land',
        'Original Sale Deed of 5 Decimals commercial plot in Shibganj, Bogura (Khatiyan no. 431).',
        '{}',
        'active',
        v_staff_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Interest renewal payment for Mortgage 3
    INSERT INTO public.payments (
        id, receipt_no, mortgage_id, paid_on, type, amount, received_by, note
    ) VALUES (
        '30000000-0000-0000-0000-000000000001'::uuid,
        'REC-202510-5001',
        v_mtg_3,
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '5 days')::date,
        'interest',
        24000,
        v_staff_id,
        'First year interest payment received. Mortgage renewed for another 1 year.'
    ) ON CONFLICT (id) DO NOTHING;

    -- 7. Mortgage 4: CLOSED (Electronics) - Paid in full & collateral returned
    INSERT INTO public.mortgages (
        id, mortgage_no, customer_id, principal, interest_rate, start_date, due_date,
        collateral_type, collateral_description, collateral_photo_paths, status,
        closed_at, collateral_returned_at, created_by
    ) VALUES (
        v_mtg_4,
        'MTG-202409-1004',
        v_cust_anwar,
        30000, -- 30,000 BDT
        25.00, -- 25% yearly => 7,500 interest
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '365 days')::date,
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '15 days')::date,
        'electronics',
        'Sony Bravia 55 inch 4K OLED Smart TV with original purchase invoice and remote.',
        '{}',
        'closed',
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '15 days')::timestamptz,
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '15 days')::timestamptz,
        v_owner_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Full settlement payment for Mortgage 4 (Principal 30,000 + Interest 7,500 = 37,500)
    INSERT INTO public.payments (
        id, receipt_no, mortgage_id, paid_on, type, amount, received_by, note
    ) VALUES (
        '30000000-0000-0000-0000-000000000002'::uuid,
        'REC-202509-5002',
        v_mtg_4,
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '15 days')::date,
        'full_payment',
        37500,
        v_owner_id,
        'Full settlement: 30,000 Principal + 7,500 Interest. TV returned in good condition.'
    ) ON CONFLICT (id) DO NOTHING;

    -- 8. Mortgage 5: ACTIVE (Gold Ring) - Due in 25 days
    INSERT INTO public.mortgages (
        id, mortgage_no, customer_id, principal, interest_rate, start_date, due_date,
        collateral_type, collateral_description, collateral_photo_paths, status, created_by
    ) VALUES (
        v_mtg_5,
        'MTG-202510-1005',
        v_cust_selim,
        25000, -- 25,000 BDT
        25.00, -- 25% yearly => 6,250 interest
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '340 days')::date,
        ((timezone('Asia/Dhaka', now()))::date + INTERVAL '25 days')::date,
        'gold',
        '21 Karat Gold Ring with Diamond cut stones (approx 11.2 grams).',
        '{}',
        'active',
        v_owner_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Advance sequences so next manual entries start cleanly
    PERFORM setval('mortgage_no_seq', 1010, true);
    PERFORM setval('receipt_no_seq', 5010, true);

    RAISE NOTICE 'Demo data seeded successfully for Owner ID: %', v_owner_id;
END $$;
