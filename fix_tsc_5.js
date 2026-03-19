const fs = require('fs');

// sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(
    /const DraggableTaskRow = \(\{ task, index, onToggle \}: \{[\s\S]*?\}\) => \{/g,
    `const DraggableTaskRow = ({ task, index, onToggle }: { task: Task, index: number, onToggle: (id: string, state: boolean) => void }) => {`
);
summary = summary.replace(/if \(onComplete\) onComplete\(task\.id\);/g, `onToggle(task.id, true);`);
fs.writeFileSync('app/sprint-summary.tsx', summary);

// TaskListSection.tsx
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: task.id });`
);
// It seems there are multiple handlersRef in TaskListSection, one for the whole list and one for the individual item. Let's just find the exact one missing the `id`.
taskList = taskList.replace(
    /index\s*\}\);\n\s*const panResponder =/g,
    `index, id: '' });\n    const [panResponder] =`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);

// TaskEditCarousel.tsx
let carousel = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
// Inject closeAndSaveRef at the very top of the function
carousel = carousel.replace(
    /export default function TaskEditCarousel\(\{/g,
    `export default function TaskEditCarousel({`
);
carousel = carousel.replace(
    /const carouselPanY =/g,
    `const closeAndSaveRef = useRef<(() => void) | undefined>(undefined);\n    const carouselPanY =`
);
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carousel);
