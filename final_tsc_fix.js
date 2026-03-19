const fs = require('fs');

// sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(
    /const DraggableTaskRow = \(\{ task, index, scrollOffset, panY, onDragStart, onDragMove, onDragEnd, onComplete \}: any\) => \{/g,
    `const DraggableTaskRow = ({ task, index, onToggle }: any) => {`
);
summary = summary.replace(/onToggle\(task\.id, true\);/g, `if (typeof onToggle === 'function') onToggle(task.id, true);`);
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
if (!carousel.includes('const closeAndSaveRef = useRef')) {
    carousel = carousel.replace(
        /const \[carouselPanY\] = useState\(\(\) => new Animated\.Value\(SCREEN_HEIGHT\)\);/g,
        `const [carouselPanY] = useState(() => new Animated.Value(SCREEN_HEIGHT));\n    const closeAndSaveRef = useRef<(() => void) | undefined>(undefined);`
    );
}
if (!carousel.includes('import { useRef')) {
    carousel = carousel.replace(/import \{ useState \}/, `import { useState, useRef }`);
}
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carousel);
