-- supabase/seed.sql
-- Demo seed data for Mortgage Management app (Bangladesh pawn/mortgage business)

DO $$
DECLARE
    v_owner_id UUID;
    v_staff_id UUID;
    v_cust_rahim UUID;
    v_cust_karim UUID;
    v_cust_fatima UUID;
    v_cust_anwar UUID;
    v_mtg_1 UUID;
    v_mtg_2 UUID;
    v_mtg_3 UUID;
    v_mtg_4 UUID;
BEGIN
    -- Check if we have users or create mock IDs for seeding
    -- In Supabase local / testing, we use predictable UUIDs
    v_owner_id := '00000000-0000-0000-0000-000000000001'::uuid;
    v_staff_id := '00000000-0000-0000-0000-000000000002'::uuid;

    -- Ensure profiles exist (if auth.users has them or for standalone seeding)
    -- In production, profiles are generated on user signup
    INSERT INTO public.profiles (id, name, role, phone, is_active)
    VALUES 
        (v_owner_id, 'Haji Mohammad Rafiq (Owner)', 'owner', '01711000001', true),
        (v_staff_id, 'Tanvir Ahmed (Manager)', 'staff', '01812000002', true)
    ON CONFLICT (id) DO NOTHING;

    -- Insert Customers
    INSERT INTO public.customers (id, name, phone, address, nid_no, notes, created_by)
    VALUES 
        (
            '10000000-0000-0000-0000-000000000001'::uuid,
            'Abdur Rahim (আব্দুর রহিম)',
            '01711223344',
            'House 12, Road 4, Sector 7, Uttara, Dhaka',
            '19852691234567890',
            'Trusted regular customer. Merchant in Kawran Bazar.',
            v_owner_id
        ),
        (
            '10000000-0000-0000-0000-000000000002'::uuid,
            'Karim Mia (করিম মিয়া)',
            '01819887766',
            'Gram: Rasulpur, Thana: Gazipur Sadar, Gazipur',
            '19903314567890123',
            'Farmer and poultry farm owner.',
            v_staff_id
        ),
        (
            '10000000-0000-0000-0000-000000000003'::uuid,
            'Fatima Begum (ফাতেমা বেগম)',
            '01912334455',
            'Flat 3B, Masterpara, Mirpur-10, Dhaka',
            '19922619876543210',
            'School teacher. Reliable family.',
            v_staff_id
        ),
        (
            '10000000-0000-0000-0000-000000000004'::uuid,
            'Anwar Hossain (আনোয়ার হোসেন)',
            '01615556677',
            'Holding 45, Station Road, Tongi, Gazipur',
            '19882699988776655',
            'Small transport business operator.',
            v_owner_id
        )
    ON CONFLICT (id) DO NOTHING;

    v_cust_rahim := '10000000-0000-0000-0000-000000000001'::uuid;
    v_cust_karim := '10000000-0000-0000-0000-000000000002'::uuid;
    v_cust_fatima := '10000000-0000-0000-0000-000000000003'::uuid;
    v_cust_anwar := '10000000-0000-0000-0000-000000000004'::uuid;

    -- 1. Active Mortgage (Gold Chain) - Due in 10 days
    v_mtg_1 := '20000000-0000-0000-0000-000000000001'::uuid;
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
        ((timezone('Asia/Dhaka', now()))::date + INTERVAL '10 days')::date, -- Due soon!
        'gold',
        '22 Karat Gold Necklace and 2 Bangles, Approx 24.5 grams with hallmarked certificate.',
        '{}',
        'active',
        v_owner_id
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. Overdue Mortgage (Motorbike) - Due 20 days ago
    v_mtg_2 := '20000000-0000-0000-0000-000000000002'::uuid;
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
        ((timezone('Asia/Dhaka', now()))::date - INTERVAL '20 days')::date, -- Overdue!
        'vehicle',
        'Hero Splendor Plus 100cc (Dhaka Metro-Ha-11-2233) with original Blue Book & Tax Token.',
        '{}',
        'active',
        v_staff_id
    ) ON CONFLICT (id) DO NOTHING;

    -- 3. Renewed Mortgage (Land Document) - Started 2 years ago, renewed once, due next year
    v_mtg_3 := '20000000-0000-0000-0000-000000000003'::uuid;
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

    -- Record the renewal interest payment for Mortgage 3
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

    -- 4. Closed Mortgage (Electronics) - Paid in full
    v_mtg_4 := '20000000-0000-0000-0000-000000000004'::uuid;
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

    -- Record the full payment for Mortgage 4 (Principal 30,000 + Interest 7,500 = 37,500)
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

END $$;
