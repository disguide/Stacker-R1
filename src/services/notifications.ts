
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

            console.log(`[NotificationService] Scheduling logic:`);
            console.log(`  Task: ${task.title}`);
            console.log(`  Task Date: ${task.date}`);
            console.log(`  Offset: ${task.reminderOffset}`);
            console.log(`  Reminder Time: ${task.reminderTime}`);
            console.log(`  Calculated DateStr: ${dateStr}`);
            console.log(`  Final Trigger: ${triggerDate.toISOString()}`);
            console.log(`  Now: ${new Date().toISOString()}`);

            // If date is in the past, don't schedule
            if (triggerDate.getTime() < Date.now()) {
                console.log(`[NotificationService] Skipping — trigger is in the past for "${task.title}" at ${triggerDate.toISOString()}`);
                return;
            }

            const secondsUntilTrigger = Math.max(1, Math.round((triggerDate.getTime() - Date.now()) / 1000));

            console.log(`[NotificationService] Firing in ${secondsUntilTrigger} seconds (${Math.round(secondsUntilTrigger / 60)} minutes)`);

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

            console.log(`[NotificationService] ✅ Scheduled "${task.title}" for ${triggerDate.toISOString()} (id: ${id})`);
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
            console.log(`[NotificationService] Cancelled notification for ${taskId}`);
        } catch (e) {
            console.error("[NotificationService] Failed to cancel notification", e);
        }
    }
};
