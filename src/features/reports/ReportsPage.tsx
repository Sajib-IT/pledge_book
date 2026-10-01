import React from 'react';
import { useI18n } from '../../lib/i18n';
import { Card, CardContent } from '../../components/ui/card';
import { BarChart3, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';

export const ReportsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('nav.reports')} (মালিকের জন্য)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            মাসিক/বার্ষিক আয়, অনাদায়ী মূলধন ও CSV এক্সপোর্ট
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          <span>CSV ডাউনলোড</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <BarChart3 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-lg">আর্থিক রিপোর্ট ও বিশ্লেষণ (Phase 2)</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            শুধুমাত্র প্রতিষ্ঠানের মালিকের জন্য মাসিক এবং বার্ষিক আয় বিবরণী।
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
