// src/features/dashboard/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { DashboardStats } from '../../types/database';
import { useAuth } from '../auth/AuthContext';
import { useMortgages } from '../mortgages/useMortgages';
import { calculateYearlyInterest } from '../../lib/calculations';

export const useDashboardStats = () => {
  const { isMockMode } = useAuth();
  const { data: mortgages = [] } = useMortgages();

  return useQuery({
    queryKey: ['dashboard_stats', isMockMode, mortgages.length],
    queryFn: async (): Promise<DashboardStats> => {
      if (isMockMode || !isSupabaseConfigured) {
        // Compute dynamically from in-memory mortgages and payments
        const today = new Date().toISOString().split('T')[0];

        const active = mortgages.filter((m) => m.status === 'active');
        const overdue = active.filter((m) => m.due_date < today);
        const due15 = active.filter((m) => {
          const d = (new Date(m.due_date).getTime() - new Date(today).getTime()) / 86400000;
          return d >= 0 && d <= 15;
        });

        const totalPrincipal = active.reduce((sum, m) => sum + m.principal, 0);
        const expectedInterestMonth = active.reduce(
          (sum, m) => sum + calculateYearlyInterest(m.principal, m.interest_rate),
          0
        );

        return {
          total_outstanding_principal: totalPrincipal,
          active_mortgages_count: active.length,
          expected_interest_this_month: expectedInterestMonth,
          overdue_count: overdue.length,
          due_within_15_days_count: due15.length,
          income_this_month: 24000,
          income_this_year: 61500,
          calculated_at: new Date().toISOString(),
        };
      }

      // Live Supabase RPC call: dashboard_stats()
      const { data, error } = await supabase.rpc('dashboard_stats');
      if (error) throw error;
      return data as DashboardStats;
    },
  });
};
