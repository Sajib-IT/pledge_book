// src/lib/notifications.ts
// Local notifications manager using @capacitor/local-notifications
// Handles notification channel initialization, permissions, scheduling, syncing, and test alerts.

import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import type { Mortgage } from '../types/database';
import { formatBDT } from './calculations';

export const NOTIFICATION_CHANNEL_ID = 'mortgage_reminders';

/**
 * Initializes the Android notification channel with high importance, vibration, and custom sound.
 * Android 8.0+ (API 26+) requires a notification channel for alerts to show properly.
 */
export async function initNotificationChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'বন্ধকী ও মেয়াদ রিমাইন্ডার (Mortgage Reminders)',
      description: 'Alerts for upcoming and overdue mortgage due dates',
      importance: 5, // NotificationImportance.High
      visibility: 1, // NotificationVisibility.Public
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#059669', // Emerald
    });
  } catch (err) {
    // Graceful fallback on web or unsupported platforms
    console.debug('Notification channel initialization skipped or not supported:', err);
  }
}

/**
 * Checks the current notification permission status.
 */
export async function checkNotificationPermission(): Promise<PermissionStatus['display']> {
  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display;
  } catch (err) {
    console.warn('Could not check notification permissions:', err);
    return 'denied';
  }
}

/**
 * Requests permission for displaying notifications.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      return true;
    }
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  } catch (err) {
    console.warn('Local notifications permission request failed:', err);
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
export async function scheduleMortgageNotifications(
  mortgage: Mortgage,
  lang: 'bn' | 'en' = 'bn'
): Promise<number> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return 0;

    await initNotificationChannel();

    // First cancel existing notifications for this mortgage if any
    await cancelMortgageNotifications(mortgage.id);

    const dueDate = new Date(`${mortgage.due_date}T09:00:00+06:00`);
    const now = new Date();

    const reminders = [
      {
        daysBefore: 15,
        title:
          lang === 'bn'
            ? '🔔 বন্ধকী মেয়াদ ১৫ দিন বাকি'
            : '🔔 Mortgage Due in 15 Days',
        body:
          lang === 'bn'
            ? `${mortgage.customer?.name || 'গ্রাহকের'} বন্ধক (${mortgage.mortgage_no}) এর মেয়াদ ১৫ দিন পর শেষ হবে। মূল আসল: ${formatBDT(mortgage.principal, 'bn')}`
            : `Mortgage ${mortgage.mortgage_no} for ${mortgage.customer?.name || 'Customer'} is due in 15 days. Principal: ${formatBDT(mortgage.principal, 'en')}`,
      },
      {
        daysBefore: 7,
        title:
          lang === 'bn'
            ? '⚠️ বন্ধকী মেয়াদ ৭ দিন বাকি'
            : '⚠️ Mortgage Due in 7 Days',
        body:
          lang === 'bn'
            ? `${mortgage.customer?.name || 'গ্রাহক'} এর বন্ধক (${mortgage.mortgage_no}) এর মেয়াদ আর মাত্র ৭ দিন বাকি। তাগাদা দিতে কল করুন।`
            : `Mortgage ${mortgage.mortgage_no} (${mortgage.customer?.name || 'Customer'}) has only 7 days remaining. Call customer to follow up.`,
      },
      {
        daysBefore: 1,
        title:
          lang === 'bn'
            ? '🚨 আগামীকাল বন্ধকীর মেয়াদ শেষ!'
            : '🚨 Mortgage Due Tomorrow!',
        body:
          lang === 'bn'
            ? `গ্রাহক: ${mortgage.customer?.name || ''}, বন্ধক: ${mortgage.mortgage_no}, মূল টাকা: ${formatBDT(mortgage.principal, 'bn')}`
            : `Customer: ${mortgage.customer?.name || ''}, Mortgage: ${mortgage.mortgage_no}, Amount: ${formatBDT(mortgage.principal, 'en')}`,
      },
      {
        daysBefore: 0,
        title:
          lang === 'bn'
            ? '⏳ আজই বন্ধকীর মেয়াদ পূর্তির তারিখ!'
            : '⏳ Mortgage Due Date Today!',
        body:
          lang === 'bn'
            ? `${mortgage.customer?.name || 'গ্রাহক'} এর বন্ধক (${mortgage.mortgage_no}) আজই রিনিউ অথবা ক্লোজ করতে হবে।`
            : `Mortgage ${mortgage.mortgage_no} (${mortgage.customer?.name || 'Customer'}) must be renewed or closed today.`,
      },
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
          schedule: { at: scheduleDate, allowWhileIdle: true },
          channelId: NOTIFICATION_CHANNEL_ID,
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
    }

    return notificationsToSchedule.length;
  } catch (err) {
    console.warn('Could not schedule local notifications:', err);
    return 0;
  }
}

/**
 * Cancels all scheduled reminders for a mortgage (e.g. when closed or renewed).
 */
export async function cancelMortgageNotifications(mortgageId: string): Promise<void> {
  try {
    const ids = [15, 7, 1, 0].map((days) => ({ id: getNotificationId(mortgageId, days) }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch (err) {
    console.warn('Could not cancel notifications:', err);
  }
}

/**
 * Reschedules reminders for all active mortgages in the portfolio.
 * Useful on app start or from Settings to ensure no due dates are missed.
 */
export async function syncAllMortgageNotifications(
  mortgages: Mortgage[],
  lang: 'bn' | 'en' = 'bn'
): Promise<{ activeMortgagesCount: number; scheduledRemindersCount: number }> {
  const activeMortgages = mortgages.filter((m) => m.status === 'active');
  let totalScheduled = 0;

  for (const mortgage of activeMortgages) {
    const count = await scheduleMortgageNotifications(mortgage, lang);
    totalScheduled += count;
  }

  return {
    activeMortgagesCount: activeMortgages.length,
    scheduledRemindersCount: totalScheduled,
  };
}

/**
 * Sends an immediate test notification (fires 3 seconds later) so the shop owner
 * can verify that notifications, sound, and vibration are working properly on their device.
 */
export async function sendTestNotification(lang: 'bn' | 'en' = 'bn'): Promise<boolean> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    await initNotificationChannel();

    const testId = 999999;
    const fireTime = new Date(Date.now() + 3000); // 3 seconds in future

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title:
            lang === 'bn'
              ? '🔔 টেস্ট নোটিফিকেশন (PledgeBook)'
              : '🔔 Test Notification (PledgeBook)',
          body:
            lang === 'bn'
              ? 'আপনার স্মার্টফোনে বন্ধকী নোটিফিকেশন সফলভাবে চালু রয়েছে। মেয়াদোত্তীর্ণের অ্যালার্ট যথাসময়ে পাবেন।'
              : 'Mobile notifications are working successfully on your device! You will receive due date alerts on time.',
          schedule: { at: fireTime, allowWhileIdle: true },
          channelId: NOTIFICATION_CHANNEL_ID,
          sound: 'beep.wav',
          extra: {
            isTest: true,
          },
        },
      ],
    });

    return true;
  } catch (err) {
    console.error('Failed to trigger test notification:', err);
    return false;
  }
}

/**
 * Sets up a listener for notification clicks.
 * When the user taps a notification on mobile, it directs them to that mortgage.
 */
export function setupNotificationListeners(
  onNavigate?: (path: string) => void
): () => void {
  try {
    const listener = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const mortgageId = action.notification.extra?.mortgageId;
        if (mortgageId && onNavigate) {
          onNavigate(`/mortgages/${mortgageId}`);
        }
      }
    );

    return () => {
      listener.then((sub) => sub.remove()).catch(() => {});
    };
  } catch (err) {
    console.debug('Local notification listener setup skipped or not supported on this platform:', err);
    return () => {};
  }
}
