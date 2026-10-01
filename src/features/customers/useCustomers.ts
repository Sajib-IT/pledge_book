// src/features/customers/useCustomers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Customer } from '../../types/database';
import { useAuth } from '../auth/AuthContext';

// Default mock customers matching seed.sql for local testing
const INITIAL_MOCK_CUSTOMERS: Customer[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Abdur Rahim (আব্দুর রহিম)',
    phone: '01711223344',
    address: 'House 12, Road 4, Sector 7, Uttara, Dhaka',
    nid_no: '19852691234567890',
    photo_path: null,
    nid_photo_path: null,
    notes: 'Trusted regular customer. Merchant in Kawran Bazar.',
    created_by: '00000000-0000-0000-0000-000000000001',
    created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    name: 'Karim Mia (করিম মিয়া)',
    phone: '01819887766',
    address: 'Gram: Rasulpur, Thana: Gazipur Sadar, Gazipur',
    nid_no: '19903314567890123',
    photo_path: null,
    nid_photo_path: null,
    notes: 'Farmer and poultry farm owner.',
    created_by: '00000000-0000-0000-0000-000000000002',
    created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    name: 'Fatima Begum (ফাতেমা বেগম)',
    phone: '01912334455',
    address: 'Flat 3B, Masterpara, Mirpur-10, Dhaka',
    nid_no: '19922619876543210',
    photo_path: null,
    nid_photo_path: null,
    notes: 'School teacher. Reliable family.',
    created_by: '00000000-0000-0000-0000-000000000002',
    created_at: new Date(Date.now() - 400 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    name: 'Anwar Hossain (আনোয়ার হোসেন)',
    phone: '01615556677',
    address: 'Holding 45, Station Road, Tongi, Gazipur',
    nid_no: '19882699988776655',
    photo_path: null,
    nid_photo_path: null,
    notes: 'Small transport business operator.',
    created_by: '00000000-0000-0000-0000-000000000001',
    created_at: new Date(Date.now() - 150 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-memory store for mock mode
let mockCustomersStore = [...INITIAL_MOCK_CUSTOMERS];

export const useCustomers = (searchQuery: string = '') => {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['customers', searchQuery, isMockMode],
    queryFn: async (): Promise<Customer[]> => {
      if (isMockMode || !isSupabaseConfigured) {
        let list = [...mockCustomersStore];
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          list = list.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.phone.includes(q) ||
              (c.nid_no && c.nid_no.includes(q))
          );
        }
        return list;
      }

      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`name.ilike.${q},phone.ilike.${q},nid_no.ilike.${q}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};

export interface CustomerInput {
  name: string;
  phone: string;
  address?: string;
  nid_no?: string;
  photo_path?: string;
  nid_photo_path?: string;
  notes?: string;
}

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  const { isMockMode, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CustomerInput): Promise<Customer> => {
      if (isMockMode || !isSupabaseConfigured) {
        const newCustomer: Customer = {
          id: `mock-${Date.now()}`,
          name: input.name,
          phone: input.phone,
          address: input.address || null,
          nid_no: input.nid_no || null,
          photo_path: input.photo_path || null,
          nid_photo_path: input.nid_photo_path || null,
          notes: input.notes || null,
          created_by: user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockCustomersStore = [newCustomer, ...mockCustomersStore];
        return newCustomer;
      }

      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: input.name,
          phone: input.phone,
          address: input.address,
          nid_no: input.nid_no,
          photo_path: input.photo_path,
          nid_photo_path: input.nid_photo_path,
          notes: input.notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  const { isMockMode } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...input }: CustomerInput & { id: string }): Promise<Customer> => {
      if (isMockMode || !isSupabaseConfigured) {
        const idx = mockCustomersStore.findIndex((c) => c.id === id);
        if (idx >= 0) {
          mockCustomersStore[idx] = {
            ...mockCustomersStore[idx],
            ...input,
            address: input.address || null,
            nid_no: input.nid_no || null,
            notes: input.notes || null,
            updated_at: new Date().toISOString(),
          };
          return mockCustomersStore[idx];
        }
        throw new Error('Customer not found');
      }

      const { data, error } = await supabase
        .from('customers')
        .update({
          name: input.name,
          phone: input.phone,
          address: input.address,
          nid_no: input.nid_no,
          photo_path: input.photo_path,
          nid_photo_path: input.nid_photo_path,
          notes: input.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  const { isMockMode } = useAuth();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (isMockMode || !isSupabaseConfigured) {
        mockCustomersStore = mockCustomersStore.filter((c) => c.id !== id);
        return;
      }

      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
