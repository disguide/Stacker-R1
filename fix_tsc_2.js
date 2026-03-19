const fs = require('fs');

// saved-sprints.tsx
let saved = fs.readFileSync('app/saved-sprints.tsx', 'utf8');
saved = saved.replace(/const \[isActive, setIsActive\] = useState\(false\);\n    const isActive = pan\.y \?\?\?/g, ``);
// the issue is `isActive` was already declared as an animated value interpolation or something in saved-sprints.
saved = saved.replace(/const \[isActive, setIsActive\] = useState\(false\);\n    const isActive = panResponderPan === idx;/g, ``);
fs.writeFileSync('app/saved-sprints.tsx', saved);

// Remove the `const [isActive, setIsActive] = useState(false);` that we just injected improperly, let's just make it a new name.
let saved2 = fs.readFileSync('app/saved-sprints.tsx', 'utf8');
saved2 = saved2.replace(/const \[isActive, setIsActive\] = useState\(false\);/g, `const [isDragging, setIsDragging] = useState(false);`);
saved2 = saved2.replace(/setIsActive\(/g, `setIsDragging(`);
fs.writeFileSync('app/saved-sprints.tsx', saved2);


// sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(/Dimensions\.get/g, `require('react-native').Dimensions.get`);
summary = summary.replace(/onToggle\(task\.id, true\);/g, `onCompleteTask?.(task.id);`);
fs.writeFileSync('app/sprint-summary.tsx', summary);

// TaskMenu.tsx
let taskMenu = fs.readFileSync('src/components/TaskMenu.tsx', 'utf8');
taskMenu = `import { useState } from 'react';\n` + taskMenu;
fs.writeFileSync('src/components/TaskMenu.tsx', taskMenu);

// TaskEditCarousel.tsx
let carousel = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
carousel = `import { useState } from 'react';\n` + carousel;
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carousel);


// TaskListSection.tsx
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: '' });`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);
