const fs = require('fs');

// sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(
    /const DraggableTaskRow = \(\{ task, index, onToggle \}: any\) => \{/g,
    `const DraggableTaskRow = ({ task, index, onToggle }: any) => {`
);
// Make sure onToggle is passed as a prop, and accessed as a prop.
// Oh wait! In my earlier regex, I broke the signature of `DraggableTaskRow`.
// It needs scrollOffset, panY, onDragStart, onDragMove, onDragEnd. Let's revert it.
summary = summary.replace(
    /const DraggableTaskRow = \(\{ task, index, onToggle \}: any\) => \{[\s\S]*?const \[progressAnim/g,
    `const DraggableTaskRow = ({ task, index, scrollOffset, panY, onDragStart, onDragMove, onDragEnd, onToggle }: any) => {\n    const [progressAnim`
);
summary = summary.replace(
    /if \(typeof onToggle === 'function'\) onToggle\(task\.id, true\);/g,
    `if (onToggle) onToggle(task.id, true);`
);
fs.writeFileSync('app/sprint-summary.tsx', summary);


// TaskListSection.tsx
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: '' });`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);

// TaskEditCarousel.tsx
let carousel = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
// remove duplicate imports of useRef
carousel = carousel.replace(/import \{ useState, useRef \}/g, `import { useState }`);
// just add closeAndSaveRef physically below the signature using regex match of component signature
carousel = carousel.replace(
    /export default function TaskEditCarousel\(\{[\s\S]*?\}\: TaskEditCarouselProps\) \{/g,
    `export default function TaskEditCarousel({
    task,
    activeFeature,
    setActiveFeature,
    deadline,
    estimatedTime,
    recurrence,
    onDeadlineChange,
    onEstimatedTimeChange,
    onRecurrenceChange,
    onClose,
    onDelete,
    onTagIdsChange,
}: TaskEditCarouselProps) {
    const closeAndSaveRef = React.useRef<(() => void) | undefined>(undefined);`
);
// clean up previous attempts at closeAndSaveRef
carousel = carousel.replace(/const closeAndSaveRef = React\.useRef<\(\(\) => void\) \| undefined>\(undefined\);/g, ``);
carousel = carousel.replace(/const closeAndSaveRef = useRef<\(\(\) => void\) \| undefined>\(undefined\);/g, ``);
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carousel);
