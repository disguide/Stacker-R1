const fs = require('fs');

// sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(/onCompleteTask\?\.\(task\.id\);/g, `onComplete(task.id);`);
fs.writeFileSync('app/sprint-summary.tsx', summary);

// TaskListSection.tsx
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index, id: '' \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: task.id });`
);
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: task.id });`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);

// TaskEditCarousel.tsx
let carousel = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
carousel = carousel.replace(
    /const closeAndSaveRef = React\.useRef<\(\(\) => void\) \| undefined>\(undefined\);/g,
    `const closeAndSaveRef = useRef<(() => void) | undefined>(undefined);`
);
// Make sure closeAndSaveRef is declared BEFORE it's used in the useMemo or useState for panResponder.
// The issue is it's declared AFTER the panResponder block. Let's move it to the top of the component.
const regexMove = /const \[carouselPanY\] = useState\(\(\) => new Animated\.Value\(SCREEN_HEIGHT\)\);/g;
carousel = carousel.replace(regexMove, `const [carouselPanY] = useState(() => new Animated.Value(SCREEN_HEIGHT));\n    const closeAndSaveRef = useRef<(() => void) | undefined>(undefined);`);
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carousel);
