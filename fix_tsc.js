const fs = require('fs');

// 1. saved-sprints.tsx
let saved = fs.readFileSync('app/saved-sprints.tsx', 'utf8');
// saved-sprints doesn't have setIsActive, it has `const [isActive, setIsActive] = useState(false);`
// Wait, `isActive` is defined locally per row, but `panResponder` is defined OUTSIDE the row in `DraggableSprintCard`? No, it's defined inside `DraggableSprintCard`.
if (!saved.includes('const [isActive, setIsActive] = useState(false);')) {
    saved = saved.replace(
        /const \[pan\] = useState\(\(\) => new Animated\.ValueXY\(\)\);/g,
        `const [pan] = useState(() => new Animated.ValueXY());\n    const [isActive, setIsActive] = useState(false);`
    );
}
fs.writeFileSync('app/saved-sprints.tsx', saved);

// 2. sprint-summary.tsx
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(
    /const maxDrag = SCREEN_WIDTH - 80;/g,
    `const { width: windowWidth } = Dimensions.get('window');\n            const maxDrag = windowWidth - 80;`
);
// onComplete is not defined in DraggableTaskRow
// Wait, DraggableTaskRow takes `task`, `onToggle`. Let's replace onComplete with onToggle.
summary = summary.replace(
    /onComplete\(task\.id\);/g,
    `onToggle(task.id, true);`
);
fs.writeFileSync('app/sprint-summary.tsx', summary);

// 3. TaskEditDrawer.tsx
let drawer = fs.readFileSync('src/components/TaskEditDrawer.tsx', 'utf8');
// `closeDrawer` is undefined, should be `onClose`
drawer = drawer.replace(/closeDrawer\(\);/g, `onClose();`);
fs.writeFileSync('src/components/TaskEditDrawer.tsx', drawer);

// 4. TaskMenu.tsx
let taskMenu = fs.readFileSync('src/components/TaskMenu.tsx', 'utf8');
if (!taskMenu.includes('useState')) {
    taskMenu = taskMenu.replace(/import { /g, `import { useState, `);
}
fs.writeFileSync('src/components/TaskMenu.tsx', taskMenu);

// 5. TaskListSection.tsx
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
// `onDragStart(h.index)` and `onDragMove(gestureState.moveY)` -> wait, the handlers defined in the `handlersRef` are:
// `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index });`
// `onDragStart(index)` inside `DraggableTaskCard` takes `(index: number, activeId: string) => void`.
// So `h.onDragStart(h.index, task.id)`. But `task.id` is not in `handlersRef`.
taskList = taskList.replace(
    /const handlersRef = useRef\(\{ onDragStart, onDragMove, onDragEnd, index \}\);/g,
    `const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index, id: task.id });`
);
taskList = taskList.replace(
    /h\.onDragStart\(h\.index\);/g,
    `h.onDragStart(h.index, h.id);`
);
taskList = taskList.replace(
    /h\.onDragMove\(gestureState\.moveY\);/g,
    `h.onDragMove(gestureState.moveY, h.id);`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);

// 6. TaskEditCarousel.tsx
let carousel = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
if (!carousel.includes('useState')) {
    carousel = carousel.replace(/import { /g, `import { useState, `);
}
// `closeAndSaveRef` is undefined because I put it after the panResponder. Let's move it before.
carousel = carousel.replace(
    /const closeAndSaveRef = React\.useRef<\(\(\) => void\) \| undefined>\(undefined\);/g,
    ``
);
carousel = carousel.replace(
    /const \[carouselPanY\] = useState\(\(\) => new Animated\.Value\(SCREEN_HEIGHT\)\);/g,
    `const [carouselPanY] = useState(() => new Animated.Value(SCREEN_HEIGHT));\n    const closeAndSaveRef = React.useRef<(() => void) | undefined>(undefined);`
);
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', carousel);
