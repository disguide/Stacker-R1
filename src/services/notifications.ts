
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task } from '../features/tasks/types';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const NotificationService = {
    // Stores the stringified fingerprint of the last scheduled set 
    // to prevent React from spamming the OS and causing duplicates
    lastScheduledState: "",

    /**
     * Request permissions (call on app start)
     */
    async requestPermissions() {
        if (Platform.OS === 'web') return false;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        return finalStatus === 'granted';
    },

    /**
     * Schedule a notification for a task
     */
    async scheduleTaskNotification(task: Task) {
        if (!task.reminderTime || !task.reminderEnabled || !task.date) return;

        // Cancel any existing notification for this task first (to avoid duplicates)
        await this.cancelTaskNotification(task.id);

        try {
            // Parse Date + Time
            // Use task.reminderDate if available, or calculate from offset
            let dateStr = task.reminderDate || task.date;

            // Offset Logic (Days Before)
            if (task.reminderOffset !== undefined) {
                const [y, m, d] = task.date.split('-').map(Number);
                const taskDate = new Date(y, m - 1, d);
                taskDate.setDate(taskDate.getDate() - task.reminderOffset);
                dateStr = `${taskDate.getFullYear()}-${(taskDate.getMonth() + 1).toString().padStart(2, '0')}-${taskDate.getDate().toString().padStart(2, '0')}`;
            }

            const [year, month, day] = dateStr.split('-').map(Number);
            const [hours, minutes] = task.reminderTime.split(':').map(Number);

            const triggerDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

            if (__DEV__) {
                console.log(`[NotificationService] Scheduling logic:`);
                console.log(`  Task: ${task.title}`);
                console.log(`  Task Date: ${task.date}`);
                console.log(`  Offset: ${task.reminderOffset}`);
                console.log(`  Reminder Time: ${task.reminderTime}`);
                console.log(`  Calculated DateStr: ${dateStr}`);
                console.log(`  Final Trigger: ${triggerDate.toISOString()}`);
                console.log(`  Now: ${new Date().toISOString()}`);
            }

            // If date is in the past, don't schedule
            if (triggerDate.getTime() < Date.now()) {
                if (__DEV__) console.log(`[NotificationService] Skipping — trigger is in the past for "${task.title}" at ${triggerDate.toISOString()}`);
                return;
            }

            const secondsUntilTrigger = Math.max(1, Math.round((triggerDate.getTime() - Date.now()) / 1000));

            if (__DEV__) console.log(`[NotificationService] Firing in ${secondsUntilTrigger} seconds (${Math.round(secondsUntilTrigger / 60)} minutes)`);

            const id = await Notifications.scheduleNotificationAsync({
                identifier: task.id, // Use task ID as notification ID for easy cancellation
                content: {
                    title: "Reminder: " + task.title,
                    body: `It's time to work on "${task.title}"`,
                    sound: true,
                    data: { taskId: task.id },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                },
            });

            if (__DEV__) console.log(`[NotificationService] ✅ Scheduled "${task.title}" for ${triggerDate.toISOString()} (id: ${id})`);
            return id;
        } catch (e) {
            console.error("[NotificationService] Failed to schedule notification", e);
        }
    },

    /**
     * Cancel a notification
     */
    async cancelTaskNotification(taskId: string) {
        try {
            await Notifications.cancelScheduledNotificationAsync(taskId);
            if (__DEV__) console.log(`[NotificationService] Cancelled notification for ${taskId}`);
        } catch (e) {
            console.error("[NotificationService] Failed to cancel notification", e);
        }
    },

    /**
     * **NEW: Global UI Sync Engine**
     * Wipes the slate clean and perfectly matches OS notifications to the currently
     * visible UI list of tasks for the active day.
     */
    async syncTodayNotifications(items: any[]) {
        if (Platform.OS === 'web') return;

        try {
            // --- NEW: FINGERPRINT CHECK ---
            // Calculate a unique signature for the tasks that currently need to ring.
            const todayStr = new Date().toDateString(); // Force a fresh sync every midnight
            const currentFingerprint = todayStr + "|" + items
                .filter(i => !i.isCompleted && i.reminderEnabled && i.reminderTime && i.type !== 'header')
                // Use originalTaskId so that multiple ghost rollovers collapse into ONE signature
                .map(i => `${i.originalTaskId || i.id}_${i.reminderTime}`)
                .sort() // Sort to ensure the order of items doesn't falsely trigger a resync
                .join('|');

            // If the exact same tasks (and times) are visible as last time, DO NOT SPAM THE OS.
            if (currentFingerprint === this.lastScheduledState) {
                if (__DEV__) console.log(`[NotificationService] 🛑 Fingerprint matched. Sync ignored to prevent OS spam.`);
                return;
            }

            // If it made it here, there is a legitimate change (task added, deleted, edited, or checked off).
            // Proceed to wipe and re-schedule.
            this.lastScheduledState = currentFingerprint;
            // -------------------------------

            // 1. Surgical Purge: Wipe the slate entirely clean to start fresh
            // We use a surgical loop because dismissAllNotificationsAsync often silently 
            // fails to delete old/stale notifications on certain OS builds
            const presented = await Notifications.getPresentedNotificationsAsync();
            const dismissPromises = presented
                .filter(notification => notification.request?.identifier)
                .map(notification => Notifications.dismissNotificationAsync(notification.request.identifier));

            await Promise.all(dismissPromises);

            // Also politely request full wipes as a fallback
            await Promise.all([
                Notifications.dismissAllNotificationsAsync(),
                Notifications.cancelAllScheduledNotificationsAsync()
            ]);

            if (__DEV__) console.log(`[NotificationService] 🧹 Wiped all delivered and scheduled OS notifications.`);

            let scheduledCount = 0;
            const now = new Date();

            // 2. Iterate only the tasks visible on this specific day's UI
            const schedulePromises = items.map(async (item) => {
                // Skip headers, completed items, or items without time/reminders
                // CalendarItem uses 'isCompleted'
                if (
                    item.type === 'header' ||
                    item.isCompleted ||
                    !item.reminderEnabled ||
                    !item.reminderTime
                ) {
                    return;
                }

                // 3. Time-Only Trigger Logic: 
                // We only care about the TIME it's supposed to ring Today.
                const timeParts = item.reminderTime.split(':').map(Number);
                if (timeParts.length !== 2) return;
                const [hours, minutes] = timeParts;

                // Create a target date for TODAY at the specified reminder time
                let targetDate = new Date();
                targetDate.setHours(hours, minutes, 0, 0);

                // 4. Fire if the time hasn't happened yet today
                if (targetDate.getTime() > now.getTime()) {
                    await Notifications.scheduleNotificationAsync({
                        identifier: item.id,
                        content: {
                            title: "Reminder: " + item.title,
                            body: `It's time to work on "${item.title}"`,
                            sound: true,
                            data: { taskId: item.originalTaskId || item.id },
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DATE,
                            date: targetDate,
                        },
                    });
                    scheduledCount++;
                    if (__DEV__) console.log(`[NotificationService] 🎯 Synced reminder for "${item.title}" at ${targetDate.toLocaleTimeString()}`);
                }
            });

            await Promise.all(schedulePromises);

            if (__DEV__) console.log(`[NotificationService] ✅ Sync Complete. ${scheduledCount} active notifications scheduled for today.`);
        } catch (e) {
            console.error("[NotificationService] Failed to sync today's notifications", e);
        }
    }
};
