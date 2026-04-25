/**
 * SyncBus - A simple event-based trigger to break circular dependencies 
 * between Storage Repositories and the Sync Service.
 */

type SyncListener = () => void;
const listeners: Set<SyncListener> = new Set();

export const SyncBus = {
    /**
     * Subscribe to sync requests
     */
    subscribe(listener: SyncListener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },

    /**
     * Emit a sync request
     */
    emit() {
        listeners.forEach(listener => listener());
    }
};

/**
 * Global trigger function to be used by repositories
 */
export const triggerSync = () => {
    SyncBus.emit();
};
