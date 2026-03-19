import { useState, useCallback, useEffect } from 'react';
import { HistoryEventAction, HistoryLog, HistoryRepository } from '../../../services/storage/HistoryRepository';
import { toISODateString } from '../../../utils/dateHelpers';

export const useHistoryLogs = () => {
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        const data = await HistoryRepository.getAll();
        setLogs(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        // Wrap in timeout or un-sync effect to avoid set-state-in-effect error in strict mode
        const timer = setTimeout(() => {
            loadLogs();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadLogs]);

    const addLog = useCallback(async (
        taskId: string,
        taskTitle: string,
        action: HistoryEventAction,
        dateString: string,
        details?: string
    ) => {
        const newLog: HistoryLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            taskId,
            taskTitle,
            action,
            timestamp: new Date().toISOString(),
            date: dateString, // The logical active day
            details
        };

        // Update local state immediately for snappy UI
        setLogs(prev => [newLog, ...prev]);

        // Persist
        await HistoryRepository.addLog(newLog);
    }, []);

    const clearLogs = useCallback(async () => {
        setLogs([]);
        await HistoryRepository.clearAll();
    }, []);

    return {
        logs,
        loading,
        addLog,
        clearLogs,
        refresh: loadLogs
    };
};
