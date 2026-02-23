import { useState, useEffect, useCallback } from 'react';
import { StorageService, MailMessage } from '../../services/storage';

const WELCOME_MESSAGE: MailMessage = {
    id: 'welcome-message-001',
    subject: 'Welcome to Stacker Mail',
    sender: 'Stacker Team',
    date: new Date().toISOString(),
    preview: 'Here is how to use your new in-app mailbox...',
    body: `Hello and welcome to Stacker!

We built this Mail hub directly into the app so you never miss an important update, release note, or pro-tip about how to achieve your goals.

In the future, we'll use this space to send you weekly summaries, community highlights, and notifications about your friends' progress.

For now, feel free to delete this message by swiping left on it in the inbox, or click the back arrow to return to your tasks.

Stay focused!
- The Stacker Team`,
    read: false
};

export function useMail() {
    const [messages, setMessages] = useState<MailMessage[]>([]);
    const [loading, setLoading] = useState(true);

    const loadMessages = useCallback(async () => {
        try {
            setLoading(true);
            let storedMail = await StorageService.loadMail();

            // Seed welcome message if the mailbox is entirely empty (first run)
            if (storedMail.length === 0) {
                // To prevent re-seeding if the user deleted all emails, we could check a generic 'hasSeenWelcome' flag.
                // For this MVP, if it's completely empty, we'll inject it once. 
                // Alternatively, we just inject it and let them delete it. If they delete it, length goes to 0... wait, that would re-trigger it.
                // Actually, let's use AsyncStorage to store an initialized flag directly here.
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const hasSeeded = await AsyncStorage.getItem('@stacker_mail_seeded');

                if (!hasSeeded) {
                    storedMail = [WELCOME_MESSAGE];
                    await StorageService.saveMail(storedMail);
                    await AsyncStorage.setItem('@stacker_mail_seeded', 'true');
                }
            }

            // Sort by descending date
            storedMail.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setMessages(storedMail);
        } catch (error) {
            console.error('[useMail] Failed to load messages:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // Ensure unread count only applies to inbox
    const inboxMessages = messages.filter(m => !m.trashed);
    const trashedMessages = messages.filter(m => m.trashed);

    const unreadCount = inboxMessages.filter(m => !m.read).length;

    const markAsRead = async (id: string) => {
        const updated = messages.map(m =>
            m.id === id ? { ...m, read: true } : m
        );
        setMessages(updated);
        await StorageService.saveMail(updated);
    };

    const moveToTrash = async (id: string) => {
        const updated = messages.map(m =>
            m.id === id ? { ...m, trashed: true, trashedAt: new Date().toISOString() } : m
        );
        setMessages(updated);
        await StorageService.saveMail(updated);
    };

    const restoreFromTrash = async (id: string) => {
        const updated = messages.map(m =>
            m.id === id ? { ...m, trashed: false, trashedAt: undefined } : m
        );
        setMessages(updated);
        await StorageService.saveMail(updated);
    };

    const deleteMessage = async (id: string) => {
        const updated = messages.filter(m => m.id !== id);
        setMessages(updated);
        await StorageService.saveMail(updated);
    };

    const emptyTrash = async () => {
        const updated = messages.filter(m => !m.trashed);
        setMessages(updated);
        await StorageService.saveMail(updated);
    };

    const markAllAsRead = async () => {
        const updated = messages.map(m => (!m.trashed ? { ...m, read: true } : m));
        setMessages(updated);
        await StorageService.saveMail(updated);
    };

    return {
        messages,
        inboxMessages,
        trashedMessages,
        unreadCount,
        loading,
        markAsRead,
        moveToTrash,
        restoreFromTrash,
        emptyTrash,
        deleteMessage,
        markAllAsRead,
        refreshMail: loadMessages
    };
}
