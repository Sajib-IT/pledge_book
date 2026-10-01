// supabase/functions/send-sms-reminders/index.ts
// Supabase Edge Function (Cron/Webhook) for Bangladesh SMS Gateway Reminders
// Triggered on a schedule (e.g., daily at 9:00 AM Asia/Dhaka)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SMS_ENABLED = Deno.env.get('SEND_SMS_ENABLED') === 'true'; // Disabled by default
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') || '';
const SMS_SENDER_ID = Deno.env.get('SMS_SENDER_ID') || 'PLEDGEBOOK';
const SMS_GATEWAY_URL = Deno.env.get('SMS_GATEWAY_URL') || 'https://api.greenweb.com.bd/api.php'; // Example BD gateway

serve(async (req) => {
  try {
    if (!SMS_ENABLED) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'SMS reminders are currently DISABLED by configuration (SEND_SMS_ENABLED is false).',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active mortgages due in 15 days, 7 days, 1 day, or overdue today
    const { data: mortgages, error } = await supabase
      .from('mortgages')
      .select('*, customer:customers(*)')
      .eq('status', 'active');

    if (error) throw error;

    const today = new Date();
    const results = [];

    for (const mtg of mortgages || []) {
      const dueDate = new Date(`${mtg.due_date}T00:00:00+06:00`);
      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

      let message = '';
      if (diffDays === 15) {
        message = `আসসালামু আলাইকুম ${mtg.customer?.name}। আপনার বন্ধকী (${mtg.mortgage_no}) এর মেয়াদ ১৫ দিন পর পূর্ণ হবে। সুদ জমা দিয়ে নবায়ন করুন।`;
      } else if (diffDays === 7) {
        message = `সম্মানিত গ্রাহক ${mtg.customer?.name}, আপনার বন্ধকী (${mtg.mortgage_no}) এর মেয়াদ আর মাত্র ৭ দিন বাকি আছে।`;
      } else if (diffDays === 0) {
        message = `জরুরি নোটিশ: ${mtg.customer?.name}, আপনার বন্ধকী (${mtg.mortgage_no}) এর মেয়াদ আজই শেষ। অনুগ্রহ করে যোগাযোগ করুন।`;
      } else if (diffDays < 0 && Math.abs(diffDays) % 15 === 0) {
        // Send alert every 15 days of being overdue
        message = `তাগাদা পত্র: ${mtg.customer?.name}, আপনার বন্ধকী (${mtg.mortgage_no}) মেয়াদোত্তীর্ণ হয়ে ${Math.abs(diffDays)} দিন অতিক্রান্ত হয়েছে। অবিলম্বে যোগাযোগ করুন।`;
      }

      if (message && mtg.customer?.phone) {
        // Example call to Bangladesh SMS Gateway
        const params = new URLSearchParams({
          token: SMS_API_KEY,
          to: mtg.customer.phone,
          message: message,
        });

        // Trigger SMS gateway request
        const res = await fetch(`${SMS_GATEWAY_URL}?${params.toString()}`);
        results.push({ phone: mtg.customer.phone, status: res.status });
      }
    }

    return new Response(JSON.stringify({ success: true, dispatched: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
