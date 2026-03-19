const fs = require('fs');

// We need to properly fix the useTaskCreation error where React Compiler failed to preserve manual memoization.
// The error was: Inferred dependency was 'setNewTaskTitle', but source dependencies were...
// Let's just remove the dependency array for handleAddTask, or use standard hooks without disabling compiler if we can,
// or maybe just keep eslint disabled for exhaustive-deps since React compiler takes over.
// Wait, the error is `Compilation Skipped`. That's not a hard eslint error unless they have `react-compiler` plugin set to error.
// The CI shows: `74:39  error    Compilation Skipped: Existing memoization could not be preserved`
// Ah! `react-hooks/preserve-manual-memoization` IS throwing an error.

let useTaskCreationCode = fs.readFileSync('src/features/home/hooks/useTaskCreation.ts', 'utf8');
// Fix handleAddTask deps to include what it complained about: `setNewTaskTitle`
useTaskCreationCode = useTaskCreationCode.replace(
    `    }, [newTaskTitle, newTaskDeadline, newTaskEstimatedTime, newTaskRecurrence, newTaskReminderTime, tasks, addTask, updateTask, cancelAddingTask]);`,
    `    }, [newTaskTitle, newTaskDeadline, newTaskEstimatedTime, newTaskRecurrence, newTaskReminderTime, tasks, addTask, updateTask, cancelAddingTask, setNewTaskTitle]);`
);
// Also for saveEditedTask:
useTaskCreationCode = useTaskCreationCode.replace(
    `    }, [tasks, addTask, updateTask, deleteTasks, generateInstances, cleanupInstances]);`,
    `    }, [tasks, addTask, updateTask, deleteTasks, generateInstances, cleanupInstances, cancelAddingTask]);`
);
fs.writeFileSync('src/features/home/hooks/useTaskCreation.ts', useTaskCreationCode);

// For TaskEditCarousel: The issue is mutating `closeAndSaveRef.current` during render. We should do it in an effect.
let carouselCode = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
carouselCode = carouselCode.replace(
`    const closeAndSave = () => {
        closeAndSaveRef.current = undefined; // satisfy linter if we must, actually we need to assign it.
    };
    closeAndSaveRef.current = () => {`,
`    const closeAndSave = () => {`
);

// Add the effect to update the ref
carouselCode = carouselCode.replace(
`    const closeAndSave = () => {`,
`    useEffect(() => {
        closeAndSaveRef.current = closeAndSave;
    });

    const closeAndSave = () => {`
);

// We need to make sure we import useEffect. It is imported.
// And `useRef` was used, so it's imported. Wait, earlier it said `useRef is defined but never used`.
// Because we changed `useRef` to `useState` for `carouselPanY`. Wait, no, we only changed it for `carouselPanResponder`.
// Let's change `carouselPanY` to use `useMemo` so we don't need refs for it, or just use `useState` for everything.
carouselCode = carouselCode.replace(
`    const carouselPanY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const closeAndSaveRef = useRef<() => void>();`,
`    const [carouselPanY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
    const closeAndSaveRef = React.useRef<() => void>(undefined);`
);

// Fix the import to include React if needed, or just remove `React.` if we import useRef.
carouselCode = carouselCode.replace(
`    const closeAndSaveRef = React.useRef<() => void>(undefined);`,
`    const closeAndSaveRef = React.useRef<(() => void) | undefined>(undefined);`
);

// Ensure React is imported
if (!carouselCode.includes("import React")) {
    carouselCode = `import React from 'react';\n` + carouselCode;
}

fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carouselCode);
