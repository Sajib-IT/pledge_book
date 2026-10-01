import React, { useState } from 'react';
import { useCustomers, useDeleteCustomer } from './useCustomers';
import { CustomerFormDialog } from './CustomerFormDialog';
import { CustomerDetailModal } from './CustomerDetailModal';
import type { Customer } from '../../types/database';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  UserPlus,
  Search,
  Phone,
  User,
  CreditCard,
  Edit2,
  Trash2,
  ChevronRight,
} from 'lucide-react';

export const CustomerList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: customers = [], isLoading, isError, error, refetch } = useCustomers(searchQuery);
  const deleteMutation = useDeleteCustomer();
  const { isOwner } = useAuth();
  const { t } = useI18n();

  const handleEdit = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCustomerToEdit(customer);
    setIsFormOpen(true);
  };

  const handleDelete = async (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${customer.name}" কে মুছে ফেলতে চান?`)) {
      try {
        await deleteMutation.mutateAsync(customer.id);
      } catch (err) {
        alert('গ্রাহক মোছা সম্ভব হয়নি। তার সক্রিয় বন্ধক বা লেনদেন থাকতে পারে।');
      }
    }
  };

  const handleOpenAdd = () => {
    setCustomerToEdit(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('customers.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            মোট নিবন্ধিত গ্রাহক: <span className="font-bold text-emerald-700">{customers.length}</span> জন
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          variant="primary"
          className="gap-2 self-start sm:self-auto shadow-md shadow-emerald-600/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('customers.add_customer')}</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="নাম, মোবাইল নম্বর বা NID দিয়ে খুঁজুন..."
          className="pl-10 h-11 bg-white shadow-2xs"
        />
      </div>

      {/* Content State */}
      {isLoading ? (
        <LoadingSpinner message={t('common.loading')} />
      ) : isError ? (
        <div className="p-6 text-center rounded-2xl bg-rose-50 border border-rose-200">
          <p className="text-sm font-semibold text-rose-700">
            {t('common.error')}: {(error as Error)?.message}
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
            {t('common.retry')}
          </Button>
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={User}
          title={searchQuery ? 'কোনো ফলাফল পাওয়া যায়নি' : t('customers.no_customers')}
          description={
            searchQuery
              ? `"${searchQuery}" এর সাথে মিলে এমন কোনো গ্রাহক নেই`
              : 'নতুন বন্ধক প্রদান করতে প্রথমে গ্রাহক তৈরি করুন'
          }
          actionLabel={t('customers.add_customer')}
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((cust) => (
            <Card
              key={cust.id}
              onClick={() => setSelectedCustomer(cust)}
              className="hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden shadow-2xs">
                    {cust.photo_path ? (
                      <img src={cust.photo_path} alt={cust.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{cust.name.trim().charAt(0)}</span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                      {cust.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{cust.phone}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>

              {cust.nid_no && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{cust.nid_no}</span>
                </div>
              )}

              {/* Action Buttons: Edit & Delete (Owner only for delete) */}
              <div className="mt-3 flex items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleEdit(cust, e)}
                  className="h-8 px-2 text-xs text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                  title={t('common.edit')}
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  <span>{t('common.edit')}</span>
                </Button>

                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleDelete(cust, e)}
                    className="h-8 px-2 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <CustomerFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        customerToEdit={customerToEdit}
      />

      {/* Detail Modal */}
      <CustomerDetailModal
        customer={selectedCustomer}
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        onEdit={(cust) => handleEdit(cust)}
      />
    </div>
  );
};
