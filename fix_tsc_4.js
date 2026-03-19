const fs = require('fs');

// sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(/onComplete\(task\.id\);/g, `if (onComplete) onComplete(task.id);`);
summary = summary.replace(/const DraggableTaskRow = \(\{ task, index, scrollOffset, panY, onDragStart, onDragMove, onDragEnd \}: \{[\s\S]*?\}\) => \{/g,
    `const DraggableTaskRow = ({ task, index, scrollOffset, panY, onDragStart, onDragMove, onDragEnd, onComplete }: any) => {`
);
fs.writeFileSync('app/sprint-summary.tsx', summary);

// TaskListSection.tsx
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index, id: task.id \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: task?.id || '' });`
);
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: task?.id || '' });`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);

// TaskEditCarousel.tsx
let carousel = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
// remove any duplicate closeAndSaveRef declarations that are below the usage
const contentLines = carousel.split('\n');
const fixedLines = [];
let foundFirst = false;
for (const line of contentLines) {
    if (line.includes('const closeAndSaveRef = ')) {
        if (!foundFirst) {
            foundFirst = true;
            fixedLines.push(line);
        } else {
            // skip
        }
    } else {
        fixedLines.push(line);
    }
}
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', fixedLines.join('\n'));
