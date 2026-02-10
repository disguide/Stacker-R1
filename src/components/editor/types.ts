import { Task } from '../../features/tasks/types';

export interface EditorCardProps {
    isActive: boolean;
    onActivate: () => void;
    // We pass the partial task or specific value? 
    // To keep it flexible, let's pass the specific value relevant to the card,
    // but often cards need context. For now, let's pass the specific value.
    // Actually, passing the whole draft task allows cards to be smarter (e.g. Recurrence might update Deadline).
    // But let's stick to specific value for purity if possible.
    // The plan said "value: any", let's be more specific per card.
    // We will define a generic interface but distinct props per component.
}

export interface DeadlineCardProps extends EditorCardProps {
    deadline?: string; // ISO Date String YYYY-MM-DD
    onChange: (date: string | undefined) => void;
}
