// src/features/mortgages/useMortgages.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Mortgage, Payment, CollateralType, MortgageStatus } from '../../types/database';
import { useAuth } from '../auth/AuthContext';
import { calculateYearlyInterest } from '../../lib/calculations';
import { scheduleMortgageNotifications, cancelMortgageNotifications } from '../../lib/notifications';

// Realistic mock store for offline/demo development matching seed.sql
// Realistic mock store for offline/demo development matching seed.sql
export let mockMortgagesStore: Mortgage[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    mortgage_no: 'MTG-202510-1001',
    customer_id: '10000000-0000-0000-0000-000000000001',
    principal: 50000,
    interest_rate: 25.0,
    start_date: new Date(Date.now() - 355 * 86400000).toISOString().split('T')[0],
    due_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0], // Due in 10 days
    collateral_type: 'gold',
    collateral_description: '22 Karat Gold Necklace and 2 Bangles, Approx 24.5 grams with hallmarked certificate.',
    collateral_photo_paths: [],
    status: 'active',
    closed_at: null,
    collateral_returned_at: null,
    created_by: '00000000-0000-0000-0000-000000000001',
    created_at: new Date(Date.now() - 355 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    customer: {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Abdur Rahim (আব্দুর রহিম)',
      phone: '01711223344',
      address: 'House 12, Road 4, Sector 7, Uttara, Dhaka',
      nid_no: '19852691234567890',
      photo_path: null,
      nid_photo_path: null,
      notes: 'Trusted regular customer. Merchant in Kawran Bazar.',
      created_by: '00000000-0000-0000-0000-000000000001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    mortgage_no: 'MTG-202509-1002',
    customer_id: '10000000-0000-0000-0000-000000000002',
    principal: 40000,
    interest_rate: 25.0,
    start_date: new Date(Date.now() - 385 * 86400000).toISOString().split('T')[0],
    due_date: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0], // Overdue by 20 days
    collateral_type: 'vehicle',
    collateral_description: 'Hero Splendor Plus 100cc (Dhaka Metro-Ha-11-2233) with original Blue Book & Tax Token.',
    collateral_photo_paths: [],
    status: 'active',
    closed_at: null,
    collateral_returned_at: null,
    created_by: '00000000-0000-0000-0000-000000000002',
    created_at: new Date(Date.now() - 385 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    customer: {
      id: '10000000-0000-0000-0000-000000000002',
      name: 'Karim Mia (করিম মিয়া)',
      phone: '01819887766',
      address: 'Gram: Rasulpur, Thana: Gazipur Sadar, Gazipur',
      nid_no: '19903314567890123',
      photo_path: null,
      nid_photo_path: null,
      notes: 'Farmer and poultry farm owner.',
      created_by: '00000000-0000-0000-0000-000000000002',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    mortgage_no: 'MTG-202410-1003',
    customer_id: '10000000-0000-0000-0000-000000000003',
    principal: 100000,
    interest_rate: 24.0,
    start_date: new Date(Date.now() - 370 * 86400000).toISOString().split('T')[0],
    due_date: new Date(Date.now() + 360 * 86400000).toISOString().split('T')[0], // Renewed
    collateral_type: 'land',
    collateral_description: 'Original Sale Deed of 5 Decimals commercial plot in Shibganj, Bogura (Khatiyan no. 431).',
    collateral_photo_paths: [],
    status: 'active',
    closed_at: null,
    collateral_returned_at: null,
    created_by: '00000000-0000-0000-0000-000000000002',
    created_at: new Date(Date.now() - 370 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    customer: {
      id: '10000000-0000-0000-0000-000000000003',
      name: 'Fatima Begum (ফাতেমা বেগম)',
      phone: '01912334455',
      address: 'Flat 3B, Masterpara, Mirpur-10, Dhaka',
      nid_no: '19922619876543210',
      photo_path: null,
      nid_photo_path: null,
      notes: 'School teacher. Reliable family.',
      created_by: '00000000-0000-0000-0000-000000000002',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    mortgage_no: 'MTG-202409-1004',
    customer_id: '10000000-0000-0000-0000-000000000004',
    principal: 30000,
    interest_rate: 25.0,
    start_date: new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0],
    due_date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
    collateral_type: 'electronics',
    collateral_description: 'Sony Bravia 55 inch 4K OLED Smart TV with original purchase invoice and remote.',
    collateral_photo_paths: [],
    status: 'closed',
    closed_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    collateral_returned_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    created_by: '00000000-0000-0000-0000-000000000001',
    created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    customer: {
      id: '10000000-0000-0000-0000-000000000004',
      name: 'Anwar Hossain (আনোয়ার হোসেন)',
      phone: '01615556677',
      address: 'Holding 45, Station Road, Tongi, Gazipur',
      nid_no: '19882699988776655',
      photo_path: null,
      nid_photo_path: null,
      notes: 'Small transport business operator.',
      created_by: '00000000-0000-0000-0000-000000000001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

export let mockPaymentsStore: Payment[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    receipt_no: 'REC-202510-5001',
    mortgage_id: '20000000-0000-0000-0000-000000000003',
    paid_on: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    type: 'interest',
    amount: 24000,
    received_by: '00000000-0000-0000-0000-000000000002',
    note: 'First year interest renewal received. Due date extended +1 year.',
    original_payment_id: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    receipt_no: 'REC-202509-5002',
    mortgage_id: '20000000-0000-0000-0000-000000000004',
    paid_on: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
    type: 'full_payment',
    amount: 37500, // 30,000 principal + 7,500 interest
    received_by: '00000000-0000-0000-0000-000000000001',
    note: 'Full settlement: 30,000 Principal + 7,500 Interest. TV returned in good condition.',
    original_payment_id: null,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

export function clearMockMortgagesStore() {
  mockMortgagesStore = [];
  mockPaymentsStore = [];
}

let receiptCounter = 5003;
let mortgageCounter = 1005;

export interface MortgagesFilter {
  search?: string;
  status?: string; // 'all' | 'active' | 'overdue' | 'closed'
}

export const useMortgages = (filters?: MortgagesFilter) => {
  const { isMockMode, user } = useAuth();

  return useQuery({
    queryKey: ['mortgages', filters, isMockMode, user?.id],
    queryFn: async (): Promise<Mortgage[]> => {
      const currentUserId = user?.id;

      if (isMockMode || !isSupabaseConfigured) {
        let list = mockMortgagesStore.filter((m) => !currentUserId || m.created_by === currentUserId);
        const todayStr = new Date().toISOString().split('T')[0];

        if (filters?.status && filters.status !== 'all') {
          if (filters.status === 'overdue') {
            list = list.filter((m) => m.status === 'active' && m.due_date < todayStr);
          } else {
            list = list.filter((m) => m.status === filters.status);
          }
        }

        if (filters?.search?.trim()) {
          const q = filters.search.toLowerCase().trim();
          list = list.filter(
            (m) =>
              m.mortgage_no.toLowerCase().includes(q) ||
              m.customer?.name.toLowerCase().includes(q) ||
              m.customer?.phone.includes(q) ||
              m.collateral_description.toLowerCase().includes(q)
          );
        }

        return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      }

      if (!currentUserId) return [];

      let query = supabase
        .from('mortgages')
        .select('*, customer:customers(*)')
        .eq('created_by', currentUserId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (filters.status === 'overdue') {
          query = query.eq('status', 'active').lt('due_date', todayStr);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Mortgage[]) || [];
    },
  });
};

export const useMortgageDetail = (mortgageId: string | undefined) => {
  const { isMockMode, user } = useAuth();

  return useQuery({
    queryKey: ['mortgage', mortgageId, isMockMode, user?.id],
    enabled: Boolean(mortgageId),
    queryFn: async (): Promise<{ mortgage: Mortgage; payments: Payment[] }> => {
      if (!mortgageId) throw new Error('Mortgage ID is required');
      const currentUserId = user?.id;

      if (isMockMode || !isSupabaseConfigured) {
        const mortgage = mockMortgagesStore.find(
          (m) => m.id === mortgageId && (!currentUserId || m.created_by === currentUserId)
        );
        if (!mortgage) throw new Error('Mortgage not found');
        const payments = mockPaymentsStore
          .filter((p) => p.mortgage_id === mortgageId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return { mortgage, payments };
      }

      if (!currentUserId) throw new Error('Not authenticated');

      // Live Supabase query scoped by user
      const { data: mortgage, error: mtgErr } = await supabase
        .from('mortgages')
        .select('*, customer:customers(*)')
        .eq('id', mortgageId)
        .eq('created_by', currentUserId)
        .single();

      if (mtgErr) throw mtgErr;

      if (mtgErr) throw mtgErr;

      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('mortgage_id', mortgageId)
        .order('created_at', { ascending: false });

      if (payErr) throw payErr;

      return {
        mortgage: mortgage as unknown as Mortgage,
        payments: (payments as unknown as Payment[]) || [],
      };
    },
  });
};

export interface HistoricalSettlementInput {
  interest_paid_through: string;
  note?: string;
}

export interface CreateMortgageInput {
  customer_id: string;
  principal: number;
  interest_rate: number;
  start_date: string;
  due_date: string;
  collateral_type: CollateralType;
  collateral_description: string;
  collateral_photo_paths?: string[];
  customer?: any;
  historical_settlement?: HistoricalSettlementInput;
}

export const useCreateMortgage = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateMortgageInput): Promise<Mortgage> => {
      if (isMockMode || !isSupabaseConfigured) {
        const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
        const mortgage_no = `MTG-${yearMonth}-${mortgageCounter++}`;
        const newMtg: Mortgage = {
          id: `mock-mtg-${Date.now()}`,
          mortgage_no,
          customer_id: input.customer_id,
          principal: input.principal,
          interest_rate: input.interest_rate,
          start_date: input.start_date,
          due_date: input.due_date,
          collateral_type: input.collateral_type,
          collateral_description: input.collateral_description,
          collateral_photo_paths: input.collateral_photo_paths || [],
          status: 'active',
          closed_at: null,
          collateral_returned_at: null,
          created_by: user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          customer: input.customer,
        };
        mockMortgagesStore = [newMtg, ...mockMortgagesStore];

        if (input.historical_settlement?.interest_paid_through) {
          const histReceiptNo = `HIST-${yearMonth}-${receiptCounter++}`;
          const histPayment: Payment = {
            id: `mock-pay-hist-${Date.now()}`,
            receipt_no: histReceiptNo,
            mortgage_id: newMtg.id,
            paid_on: input.historical_settlement.interest_paid_through,
            type: 'interest',
            amount: 0,
            received_by: user?.id || null,
            note:
              input.historical_settlement.note ||
              'বিগত বছরগুলোর বার্ষিক সুদ অফলাইন রসিদে পরিশোধিত। সফটওয়্যারে চলতি মেয়াদের হিসাব শুরু।',
            original_payment_id: null,
            created_at: new Date().toISOString(),
          };
          mockPaymentsStore = [histPayment, ...mockPaymentsStore];
        }

        return newMtg;
      }

      // Calls Postgres RPC create_mortgage
      const { data, error } = await supabase.rpc('create_mortgage', {
        p_customer_id: input.customer_id,
        p_principal: input.principal,
        p_interest_rate: input.interest_rate,
        p_collateral_type: input.collateral_type,
        p_collateral_description: input.collateral_description,
        p_collateral_photo_paths: input.collateral_photo_paths || [],
        p_start_date: input.start_date,
        p_due_date: input.due_date,
      });

      if (error) throw error;
      const createdMtg = data as unknown as Mortgage;

      if (input.historical_settlement?.interest_paid_through && createdMtg?.id) {
        try {
          const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
          const histReceiptNo = `HIST-${yearMonth}-${Math.floor(1000 + Math.random() * 9000)}`;
          await supabase.from('payments').insert({
            mortgage_id: createdMtg.id,
            receipt_no: histReceiptNo,
            paid_on: input.historical_settlement.interest_paid_through,
            type: 'interest',
            amount: 0,
            received_by: user?.id || null,
            note:
              input.historical_settlement.note ||
              'বিগত বছরগুলোর বার্ষিক সুদ অফলাইন রসিদে পরিশোধিত। সফটওয়্যারে চলতি মেয়াদের হিসাব শুরু।',
          });
        } catch (histErr) {
          console.warn('Failed to insert historical opening payment:', histErr);
        }
      }

      return createdMtg;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      if (data) scheduleMortgageNotifications(data);
    },
  });
};

export interface RecordHistoricalSettlementInput {
  mortgageId: string;
  interestPaidThrough: string;
  newDueDate?: string;
  note?: string;
}

export const useRecordHistoricalSettlement = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      mortgageId,
      interestPaidThrough,
      newDueDate,
      note,
    }: RecordHistoricalSettlementInput) => {
      const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const histReceiptNo = `HIST-${yearMonth}-${Math.floor(1000 + Math.random() * 9000)}`;
      const histNote =
        note || 'বিগত বছরগুলোর বার্ষিক সুদ অফলাইন রসিদে পরিশোধিত। সফটওয়্যারে চলতি মেয়াদের হিসাব কার্যকর।';

      if (isMockMode || !isSupabaseConfigured) {
        const mtgIndex = mockMortgagesStore.findIndex((m) => m.id === mortgageId);
        if (mtgIndex === -1) throw new Error('Mortgage not found');

        const histPayment: Payment = {
          id: `mock-pay-hist-${Date.now()}`,
          receipt_no: histReceiptNo,
          mortgage_id: mortgageId,
          paid_on: interestPaidThrough,
          type: 'interest',
          amount: 0,
          received_by: user?.id || null,
          note: histNote,
          original_payment_id: null,
          created_at: new Date().toISOString(),
        };

        mockPaymentsStore = [histPayment, ...mockPaymentsStore];

        if (newDueDate) {
          mockMortgagesStore[mtgIndex] = {
            ...mockMortgagesStore[mtgIndex],
            due_date: newDueDate,
            updated_at: new Date().toISOString(),
          };
        }

        return { success: true, receipt_no: histReceiptNo };
      }

      // Live Supabase insert into payments
      const { error: payErr } = await supabase.from('payments').insert({
        mortgage_id: mortgageId,
        receipt_no: histReceiptNo,
        paid_on: interestPaidThrough,
        type: 'interest',
        amount: 0,
        received_by: user?.id || null,
        note: histNote,
      });
      if (payErr) throw payErr;

      if (newDueDate) {
        const { error: mtgErr } = await supabase
          .from('mortgages')
          .update({
            due_date: newDueDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mortgageId);
        if (mtgErr) throw mtgErr;
      }

      return { success: true, receipt_no: histReceiptNo };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage', variables.mortgageId] });
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
};

export const useRenewMortgage = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      mortgageId,
      paidOn,
      note,
      amount,
    }: {
      mortgageId: string;
      paidOn: string;
      note?: string;
      amount?: number;
    }) => {
      if (isMockMode || !isSupabaseConfigured) {
        const currentUserId = user?.id;
        const mtgIndex = mockMortgagesStore.findIndex(
          (m) => m.id === mortgageId && (!currentUserId || m.created_by === currentUserId)
        );
        if (mtgIndex === -1) throw new Error('Mortgage not found');

        const mtg = mockMortgagesStore[mtgIndex];
        const interestAmount =
          amount !== undefined && amount > 0
            ? Math.round(amount)
            : calculateYearlyInterest(mtg.principal, mtg.interest_rate);

        // Advance due_date by 1 year
        const currentDue = new Date(mtg.due_date);
        currentDue.setFullYear(currentDue.getFullYear() + 1);
        const newDueDate = currentDue.toISOString().split('T')[0];

        const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
        const receipt_no = `REC-${yearMonth}-${receiptCounter++}`;

        const newPayment: Payment = {
          id: `mock-pay-${Date.now()}`,
          receipt_no,
          mortgage_id: mortgageId,
          paid_on: paidOn,
          type: 'interest',
          amount: interestAmount,
          received_by: user?.id || null,
          note: note || 'Yearly renewal interest payment',
          original_payment_id: null,
          created_at: new Date().toISOString(),
        };

        mockMortgagesStore[mtgIndex] = {
          ...mtg,
          due_date: newDueDate,
          updated_at: new Date().toISOString(),
        };

        mockPaymentsStore = [newPayment, ...mockPaymentsStore];
        return { success: true, receipt_no, amount: interestAmount, new_due_date: newDueDate };
      }

      // Live Supabase RPC call
      const { data, error } = await supabase.rpc('renew_mortgage', {
        p_mortgage_id: mortgageId,
        p_paid_on: paidOn,
        p_note: note || null,
        p_amount: amount ? Math.round(amount) : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage', variables.mortgageId] });
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });

      // Reschedule notifications for the new +1 year term
      const cached = queryClient.getQueryData<{ mortgage: Mortgage; payments: any[] }>([
        'mortgage',
        variables.mortgageId,
        isMockMode,
      ]);
      if (cached?.mortgage && data?.new_due_date) {
        scheduleMortgageNotifications({
          ...cached.mortgage,
          due_date: data.new_due_date,
        });
      }
    },
  });
};

export const useCloseMortgage = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      mortgageId,
      paidOn,
      note,
      amount,
    }: {
      mortgageId: string;
      paidOn: string;
      note?: string;
      amount?: number;
    }) => {
      if (isMockMode || !isSupabaseConfigured) {
        const currentUserId = user?.id;
        const mtgIndex = mockMortgagesStore.findIndex(
          (m) => m.id === mortgageId && (!currentUserId || m.created_by === currentUserId)
        );
        if (mtgIndex === -1) throw new Error('Mortgage not found');

        const mtg = mockMortgagesStore[mtgIndex];
        const defaultInterest = calculateYearlyInterest(mtg.principal, mtg.interest_rate);
        const totalAmount =
          amount !== undefined && amount > 0
            ? Math.round(amount)
            : mtg.principal + defaultInterest;

        const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
        const receipt_no = `REC-${yearMonth}-${receiptCounter++}`;

        const newPayment: Payment = {
          id: `mock-pay-${Date.now()}`,
          receipt_no,
          mortgage_id: mortgageId,
          paid_on: paidOn,
          type: 'full_payment',
          amount: totalAmount,
          received_by: user?.id || null,
          note: note || 'Principal + Interest full settlement for mortgage closure',
          original_payment_id: null,
          created_at: new Date().toISOString(),
        };

        const now = new Date().toISOString();
        mockMortgagesStore[mtgIndex] = {
          ...mtg,
          status: 'closed',
          closed_at: now,
          collateral_returned_at: now,
          updated_at: now,
        };

        mockPaymentsStore = [newPayment, ...mockPaymentsStore];
        return {
          success: true,
          receipt_no,
          principal: mtg.principal,
          interest: totalAmount - mtg.principal,
          total_amount: totalAmount,
          closed_at: now,
        };
      }

      // Live Supabase RPC call
      const { data, error } = await supabase.rpc('close_mortgage', {
        p_mortgage_id: mortgageId,
        p_paid_on: paidOn,
        p_note: note || null,
        p_amount: amount ? Math.round(amount) : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage', variables.mortgageId] });
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      cancelMortgageNotifications(variables.mortgageId);
    },
  });
};

export const useAddCorrection = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      paymentId,
      mortgageId: _mortgageId,
      reason,
    }: {
      paymentId: string;
      mortgageId: string;
      reason: string;
    }) => {
      if (isMockMode || !isSupabaseConfigured) {
        const currentUserId = user?.id;
        const origPayment = mockPaymentsStore.find((p) => p.id === paymentId);
        if (!origPayment) throw new Error('Payment not found');
        if (origPayment.type === 'correction') throw new Error('Cannot reverse a correction entry');

        const parentMtg = mockMortgagesStore.find((m) => m.id === origPayment.mortgage_id);
        if (!parentMtg || (currentUserId && parentMtg.created_by !== currentUserId)) {
          throw new Error('Unauthorized to reverse this payment');
        }

        const alreadyCorrected = mockPaymentsStore.some((p) => p.original_payment_id === paymentId);
        if (alreadyCorrected) throw new Error('Payment already reversed');

        const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
        const receipt_no = `REC-${yearMonth}-${receiptCounter++}`;

        const reversalPayment: Payment = {
          id: `mock-pay-${Date.now()}`,
          receipt_no,
          mortgage_id: origPayment.mortgage_id,
          paid_on: new Date().toISOString().split('T')[0],
          type: 'correction',
          amount: -origPayment.amount, // Negative reversal
          received_by: user?.id || null,
          note: `REVERSAL of ${origPayment.receipt_no}: ${reason}`,
          original_payment_id: paymentId,
          created_at: new Date().toISOString(),
        };

        mockPaymentsStore = [reversalPayment, ...mockPaymentsStore];

        // Revert mortgage status if was full_payment
        const mtgIndex = mockMortgagesStore.findIndex((m) => m.id === origPayment.mortgage_id);
        if (mtgIndex >= 0) {
          const mtg = mockMortgagesStore[mtgIndex];
          if (origPayment.type === 'full_payment' && mtg.status === 'closed') {
            mockMortgagesStore[mtgIndex] = {
              ...mtg,
              status: 'active',
              closed_at: null,
              collateral_returned_at: null,
              updated_at: new Date().toISOString(),
            };
          } else if (origPayment.type === 'interest') {
            const currentDue = new Date(mtg.due_date);
            currentDue.setFullYear(currentDue.getFullYear() - 1);
            mockMortgagesStore[mtgIndex] = {
              ...mtg,
              due_date: currentDue.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            };
          }
        }

        return { success: true, receipt_no, reversal_amount: -origPayment.amount };
      }

      // Live Supabase RPC call
      const { data, error } = await supabase.rpc('add_correction', {
        p_payment_id: paymentId,
        p_reason: reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage', variables.mortgageId] });
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
};

export interface MortgageUpdateInput {
  id: string;
  principal?: number;
  interest_rate?: number;
  start_date?: string;
  due_date?: string;
  collateral_type?: CollateralType;
  collateral_description?: string;
  collateral_photo_paths?: string[];
  status?: MortgageStatus;
}

export const useUpdateMortgage = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...input }: MortgageUpdateInput): Promise<Mortgage> => {
      const currentUserId = user?.id;

      if (isMockMode || !isSupabaseConfigured) {
        const idx = mockMortgagesStore.findIndex(
          (m) => m.id === id && (!currentUserId || m.created_by === currentUserId)
        );
        if (idx === -1) throw new Error('Mortgage not found');

        const updated: Mortgage = {
          ...mockMortgagesStore[idx],
          ...input,
          updated_at: new Date().toISOString(),
        };
        mockMortgagesStore[idx] = updated;
        return updated;
      }

      if (!currentUserId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('mortgages')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('created_by', currentUserId)
        .select(`
          *,
          customer:customers(*)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage', data.id] });
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
};

export const useDeleteMortgage = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async (mortgageId: string): Promise<void> => {
      const currentUserId = user?.id;

      if (isMockMode || !isSupabaseConfigured) {
        mockPaymentsStore = mockPaymentsStore.filter((p) => p.mortgage_id !== mortgageId);
        mockMortgagesStore = mockMortgagesStore.filter((m) => m.id !== mortgageId);
        cancelMortgageNotifications(mortgageId);
        return;
      }

      if (!currentUserId) throw new Error('Not authenticated');

      // Attempt cascade RPC first
      const { error: rpcError } = await supabase.rpc('delete_mortgage', {
        p_mortgage_id: mortgageId,
      });

      if (rpcError) {
        // Fallback: delete related payments first, then mortgage
        const { error: payError } = await supabase
          .from('payments')
          .delete()
          .eq('mortgage_id', mortgageId);
        if (payError) console.warn('Payments delete warning:', payError.message);

        const { error: delError } = await supabase
          .from('mortgages')
          .delete()
          .eq('id', mortgageId);
        if (delError) throw delError;
      }

      cancelMortgageNotifications(mortgageId);
    },
    onSuccess: (_, mortgageId) => {
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['mortgage', mortgageId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      queryClient.invalidateQueries({ queryKey: ['due_list'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
};

export interface CapitalizeInterestInput {
  mortgageId: string;
  addedAmount: number;
  newDueDate?: string;
  note?: string;
}

export const useCapitalizeInterest = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      mortgageId,
      addedAmount,
      newDueDate,
      note,
    }: CapitalizeInterestInput): Promise<{ newPrincipal: number }> => {
      const currentUserId = user?.id;
      const safeAdded = Math.round(Number(addedAmount) || 0);
      if (safeAdded <= 0) throw new Error('Added amount must be greater than zero');

      if (isMockMode || !isSupabaseConfigured) {
        const idx = mockMortgagesStore.findIndex(
          (m) => m.id === mortgageId && (!currentUserId || m.created_by === currentUserId)
        );
        if (idx === -1) throw new Error('Mortgage not found');

        const currentMtg = mockMortgagesStore[idx];
        const newPrincipal = currentMtg.principal + safeAdded;
        const now = new Date().toISOString();

        mockMortgagesStore[idx] = {
          ...currentMtg,
          principal: newPrincipal,
          due_date: newDueDate || currentMtg.due_date,
          collateral_description: note
            ? `${currentMtg.collateral_description} | [আসল বৃদ্ধি: +৳${safeAdded} (${note})]`
            : currentMtg.collateral_description,
          updated_at: now,
        };

        return { newPrincipal };
      }

      if (!currentUserId) throw new Error('Not authenticated');

      // Fetch current principal
      const { data: mtg, error: fetchErr } = await supabase
        .from('mortgages')
        .select('principal, collateral_description')
        .eq('id', mortgageId)
        .eq('created_by', currentUserId)
        .single();

      if (fetchErr || !mtg) throw fetchErr || new Error('Mortgage not found');

      const newPrincipal = Number(mtg.principal) + safeAdded;
      const updatePayload: Record<string, unknown> = {
        principal: newPrincipal,
        updated_at: new Date().toISOString(),
      };

      if (newDueDate) {
        updatePayload.due_date = newDueDate;
      }

      if (note) {
        updatePayload.collateral_description = `${mtg.collateral_description} | [আসল বৃদ্ধি: +৳${safeAdded} (${note})]`;
      }

      const { error: updateErr } = await supabase
        .from('mortgages')
        .update(updatePayload)
        .eq('id', mortgageId)
        .eq('created_by', currentUserId);

      if (updateErr) throw updateErr;

      return { newPrincipal };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage', variables.mortgageId] });
      queryClient.invalidateQueries({ queryKey: ['mortgages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
};

