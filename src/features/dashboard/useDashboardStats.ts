// src/features/dashboard/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { DashboardStats } from '../../types/database';
import { useAuth } from '../auth/AuthContext';
import { useMortgages, mockPaymentsStore, mockMortgagesStore } from '../mortgages/useMortgages';
import { calculateYearlyInterest } from '../../lib/calculations';

export const useDashboardStats = () => {
  const { isMockMode, user } = useAuth();
  const { data: mortgages = [] } = useMortgages();

  return useQuery({
    queryKey: ['dashboard_stats', isMockMode, user?.id, mortgages.length],
    queryFn: async (): Promise<DashboardStats> => {
      if (isMockMode || !isSupabaseConfigured) {
        // Compute dynamically from in-memory mortgages and payments for this user
        const currentUserId = user?.id;
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

        const userMortgageIds = new Set(
          mockMortgagesStore
            .filter((m) => !currentUserId || m.created_by === currentUserId)
            .map((m) => m.id)
        );
        const userPayments = mockPaymentsStore.filter((p) => userMortgageIds.has(p.mortgage_id));
        const currentMonth = today.slice(0, 7);
        const currentYear = today.slice(0, 4);
        const incomeThisMonth = userPayments
          .filter((p) => p.paid_on.startsWith(currentMonth))
          .reduce((sum, p) => sum + p.amount, 0);
        const incomeThisYear = userPayments
          .filter((p) => p.paid_on.startsWith(currentYear))
          .reduce((sum, p) => sum + p.amount, 0);

        return {
          total_outstanding_principal: totalPrincipal,
          active_mortgages_count: active.length,
          expected_interest_this_month: expectedInterestMonth,
          overdue_count: overdue.length,
          due_within_15_days_count: due15.length,
          income_this_month: incomeThisMonth,
          income_this_year: incomeThisYear,
          calculated_at: new Date().toISOString(),
        };
      }

      // Live Supabase RPC call: dashboard_stats() (user scoped in Postgres)
      const { data, error } = await supabase.rpc('dashboard_stats');
      if (error) throw error;
      return data as DashboardStats;
    },
  });
};

