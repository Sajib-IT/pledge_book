// src/lib/notifications.ts
// Local notifications manager using @capacitor/local-notifications
// Schedules alerts 15, 7, and 1 day before due date, and on the due date.

import { LocalNotifications } from '@capacitor/local-notifications';
import type { Mortgage } from '../types/database';
import { formatBDT } from './calculations';

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      return true;
    }
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  } catch (err) {
    console.warn('Local notifications not supported on this platform/web browser:', err);
    return false;
  }
}

/**
 * Creates unique numeric ID based on string UUID and offset index.
 */
function getNotificationId(mortgageId: string, offsetDays: number): number {
  let hash = 0;
  for (let i = 0; i < mortgageId.length; i++) {
    hash = (hash << 5) - hash + mortgageId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000000) * 10 + offsetDays;
}

/**
 * Schedules 4 reminders for a mortgage:
 * 1. 15 days before due date
 * 2. 7 days before due date
 * 3. 1 day before due date
 * 4. On the due date (0 days)
 */
export async function scheduleMortgageNotifications(mortgage: Mortgage): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // First cancel existing notifications for this mortgage if any
    await cancelMortgageNotifications(mortgage.id);

    const dueDate = new Date(`${mortgage.due_date}T09:00:00+06:00`);
    const now = new Date();

    const reminders = [
      { daysBefore: 15, title: '🔔 বন্ধকী মেয়াদ ১৫ দিন বাকি', body: `${mortgage.customer?.name || 'গ্রাহকের'} বন্ধক (${mortgage.mortgage_no}) এর মেয়াদ ১৫ দিন পর শেষ হবে। মূল আসল: ${formatBDT(mortgage.principal, 'bn')}` },
      { daysBefore: 7, title: '⚠️ বন্ধকী মেয়াদ ৭ দিন বাকি', body: `${mortgage.customer?.name || 'গ্রাহক'} এর বন্ধক (${mortgage.mortgage_no}) এর মেয়াদ আর মাত্র ৭ দিন বাকি। তাগাদা দিতে কল করুন।` },
      { daysBefore: 1, title: '🚨 আগামীকাল বন্ধকীর মেয়াদ শেষ!', body: `গ্রাহক: ${mortgage.customer?.name || ''}, বন্ধক: ${mortgage.mortgage_no}, মূল টাকা: ${formatBDT(mortgage.principal, 'bn')}` },
      { daysBefore: 0, title: '⏳ আজই বন্ধকীর মেয়াদ পূর্তির তারিখ!', body: `${mortgage.customer?.name || 'গ্রাহক'} এর বন্ধক (${mortgage.mortgage_no}) আজই রিনিউ অথবা ক্লোজ করতে হবে।` },
    ];

    const notificationsToSchedule = [];

    for (const reminder of reminders) {
      const scheduleDate = new Date(dueDate.getTime() - reminder.daysBefore * 86400000);
      // Only schedule if the reminder date is in the future
      if (scheduleDate.getTime() > now.getTime()) {
        notificationsToSchedule.push({
          id: getNotificationId(mortgage.id, reminder.daysBefore),
          title: reminder.title,
          body: reminder.body,
          schedule: { at: scheduleDate },
          sound: 'beep.wav',
          extra: {
            mortgageId: mortgage.id,
            mortgageNo: mortgage.mortgage_no,
            customerId: mortgage.customer_id,
          },
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
      console.log(`Scheduled ${notificationsToSchedule.length} reminders for mortgage ${mortgage.mortgage_no}`);
    }
  } catch (err) {
    console.warn('Could not schedule local notifications:', err);
  }
}

/**
 * Cancels all scheduled reminders for a mortgage (e.g. when closed or deleted).
 */
export async function cancelMortgageNotifications(mortgageId: string): Promise<void> {
  try {
    const ids = [15, 7, 1, 0].map((days) => ({ id: getNotificationId(mortgageId, days) }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch (err) {
    console.warn('Could not cancel notifications:', err);
  }
}
