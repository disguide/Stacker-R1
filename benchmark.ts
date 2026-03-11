import { RecurrenceEngine } from './src/features/tasks/logic/recurrenceEngine';
import { RolloverSystem } from './src/features/tasks/logic/rolloverSystem';
import { Task } from './src/features/tasks/types';

const generateMockTasks = (count: number): Task[] => {
    return Array.from({ length: count }, (_, i) => ({
        id: `mock_${i}`,
        title: `Task ${i}`,
        date: new Date().toISOString().split('T')[0],
        completed: false,
        rrule: i % 10 === 0 ? 'FREQ=DAILY' : undefined
    })) as unknown as Task[];
};

const runBenchmark = () => {
    const tasks = generateMockTasks(1000); // Test with 1000 tasks
    
    console.log('--- Benchmarking 1000 Tasks ---');
    
    // Test Rollover
    const startRollover = performance.now();
    RolloverSystem.getRolloverActions(tasks);
    const endRollover = performance.now();
    console.log(`RolloverSystem time: ${(endRollover - startRollover).toFixed(2)}ms`);

    // Test Recurrence
    const startRecurrence = performance.now();
    RecurrenceEngine.generateCalendarItems(tasks, new Date().toISOString().split('T')[0], 30);
    const endRecurrence = performance.now();
    console.log(`RecurrenceEngine time: ${(endRecurrence - startRecurrence).toFixed(2)}ms`);
};

runBenchmark();
