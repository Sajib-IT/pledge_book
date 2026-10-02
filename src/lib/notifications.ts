// src/lib/notifications.ts
// Local notifications manager using @capacitor/local-notifications and Web Notifications
// Handles notification channel initialization, permissions, scheduling, syncing, sound, and test alerts.

import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Mortgage } from '../types/database';
import { formatBDT } from './calculations';

// Updated channel ID to ensure Android recreates the channel with default sound
export const NOTIFICATION_CHANNEL_ID = 'pledgebook_mortgage_alerts_v2';
export const LEGACY_CHANNEL_ID = 'mortgage_reminders';

/**
 * Initializes the Android notification channel with high importance, vibration, and system sound.
 * Android 8.0+ (API 26+) requires a notification channel for alerts to show properly.
 */
export async function initNotificationChannel(): Promise<void> {
  try {
    // Delete legacy channel that had invalid custom sound URI
    try {
      await LocalNotifications.deleteChannel({ id: LEGACY_CHANNEL_ID });
    } catch {
      // Ignored if channel doesn't exist
    }

    // Create the active channel with max importance and vibration
    // Omitting custom sound allows Android to use the device's native system notification sound
    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'বন্ধকী ও মেয়াদ রিমাইন্ডার (Mortgage Alerts)',
      description: 'Alerts for upcoming and overdue mortgage due dates',
      importance: 5, // NotificationImportance.High
      visibility: 1, // NotificationVisibility.Public
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
 * Synthesizes a crisp, pleasant two-tone notification chime (880Hz -> 1320Hz)
 * using the Web Audio API. Works reliably on all browsers and mobile WebViews without external audio files.
 */
export function playNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: High crisp ding (880 Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: Harmonic resolving chime (1320 Hz - E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.12);
    gain2.gain.setValueAtTime(0.45, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.debug('Audio chime synthesis error:', err);
  }
}

/**
 * Checks the current notification permission status.
 */
export async function checkNotificationPermission(): Promise<PermissionStatus['display']> {
  try {
    if (!Capacitor.isNativePlatform() && 'Notification' in window) {
      const perm = Notification.permission;
      if (perm === 'granted') return 'granted';
      if (perm === 'denied') return 'denied';
      return 'prompt';
    }
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
    if (!Capacitor.isNativePlatform() && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return true;
      }
      const res = await Notification.requestPermission();
      return res === 'granted';
    }

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
 * Sends a test notification immediately so the shop owner can verify that notifications,
 * sound, and vibration are working properly on their device.
 * Ensures fresh unique tags/IDs so repeated clicks always trigger sound and alert without page refresh.
 */
export async function sendTestNotification(lang: 'bn' | 'en' = 'bn'): Promise<boolean> {
  try {
    // 1. Play immediate audio chime through device speakers
    playNotificationSound();

    const title =
      lang === 'bn'
        ? '🔔 টেস্ট নোটিফিকেশন (PledgeBook)'
        : '🔔 Test Notification (PledgeBook)';
    const body =
      lang === 'bn'
        ? 'আপনার ফোনে বন্ধকী নোটিফিকেশন সফলভাবে চালু রয়েছে। মেয়াদোত্তীর্ণের অ্যালার্ট যথাসময়ে পাবেন।'
        : 'Mobile notifications are working successfully on your device! You will receive due date alerts on time.';

    // 2. Direct browser notification handling on Web for instant repeat testing
    if (!Capacitor.isNativePlatform() && 'Notification' in window) {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      if (perm === 'granted') {
        // Unique tag ensures the browser never suppresses repeated notifications
        const uniqueTag = `pledgebook-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        try {
          const n = new Notification(title, {
            body,
            icon: '/app-icon.jpg',
            tag: uniqueTag,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
          return true;
        } catch (e) {
          console.warn('Direct web notification failed, falling back to LocalNotifications:', e);
        }
      } else if (perm === 'denied') {
        return false;
      }
    }

    // 3. Native Android / iOS via Capacitor LocalNotifications
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    await initNotificationChannel();

    // Unique random ID for each notification so it never collides or gets deduplicated
    const testId = Math.floor(Math.random() * 899999) + 100000;
    const fireTime = new Date(Date.now() + 500); // 500ms delay to show immediately

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title,
          body,
          schedule: { at: fireTime, allowWhileIdle: true },
          channelId: NOTIFICATION_CHANNEL_ID,
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
