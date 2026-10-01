// src/types/database.ts
// Database types mirroring Supabase PostgreSQL schema

export type UserRole = 'owner' | 'staff';
export type CollateralType = 'gold' | 'land' | 'vehicle' | 'electronics' | 'other';
export type MortgageStatus = 'active' | 'closed' | 'defaulted';
export type PaymentType = 'interest' | 'full_payment' | 'correction';

export interface Profile {
  id: string; // references auth.users.id
  name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  nid_no: string | null;
  photo_path: string | null;
  nid_photo_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mortgage {
  id: string;
  mortgage_no: string;
  customer_id: string;
  principal: number; // Stored as integer BDT
  interest_rate: number; // Flat yearly rate (e.g. 25.00)
  start_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  collateral_type: CollateralType;
  collateral_description: string;
  collateral_photo_paths: string[];
  status: MortgageStatus;
  closed_at: string | null;
  collateral_returned_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  customer?: Customer;
}

export interface Payment {
  id: string;
  receipt_no: string;
  mortgage_id: string;
  paid_on: string; // YYYY-MM-DD
  type: PaymentType;
  amount: number; // Stored as integer BDT (negative for corrections)
  received_by: string | null;
  note: string | null;
  original_payment_id: string | null;
  created_at: string;
  // Joins
  mortgage?: Mortgage;
  receiver_profile?: Profile;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  total_outstanding_principal: number;
  active_mortgages_count: number;
  expected_interest_this_month: number;
  overdue_count: number;
  due_within_15_days_count: number;
  income_this_month: number;
  income_this_year: number;
  calculated_at: string;
}
