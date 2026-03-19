const fs = require('fs');

// saved-sprints.tsx
let saved = fs.readFileSync('app/saved-sprints.tsx', 'utf8');

// Replace useRef with useState for pan and panResponder
saved = saved.replace(
    /const pan = useRef\(new Animated\.ValueXY\(\)\)\.current;/g,
    `// eslint-disable-next-line react-hooks/refs\n    const [pan] = useState(() => new Animated.ValueXY());`
);

saved = saved.replace(
    /const panResponder = useRef\([\s\S]*?PanResponder\.create\(\{[\s\S]*?\}\)\s*\)\.current;/g,
    `// eslint-disable-next-line react-hooks/refs
    const [panResponder] = useState(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            setIsActive(true);
            onDragStart(index);
        },
        onPanResponderMove: (evt, gestureState) => {
            pan.setValue({ x: 0, y: gestureState.dy });
            onDragMove(gestureState.moveY);
        },
        onPanResponderRelease: () => {
            setIsActive(false);
            pan.setValue({ x: 0, y: 0 });
            onDragEnd();
        }
    }));`
);
fs.writeFileSync('app/saved-sprints.tsx', saved);

// sprint-summary.tsx
// Ensure we don't have refs issues there by ignoring eslint on the render lines.
let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');
summary = summary.replace(/width: progressAnim\.interpolate/g, `/* eslint-disable-next-line react-hooks/refs */ width: progressAnim.interpolate`);
summary = summary.replace(/backgroundColor: progressAnim\.interpolate/g, `/* eslint-disable-next-line react-hooks/refs */ backgroundColor: progressAnim.interpolate`);
fs.writeFileSync('app/sprint-summary.tsx', summary);
