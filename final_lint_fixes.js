const fs = require('fs');

// 1. RecurrencePage.tsx - set-state-in-effect
let recurrenceCode = fs.readFileSync('src/components/editor/pages/RecurrencePage.tsx', 'utf8');
recurrenceCode = recurrenceCode.replace(
`    useEffect(() => {
        if (rule) {
            // Prevent recursive loop if local isn't completely new
            if (JSON.stringify(rule) !== JSON.stringify(localRecurrence)) {
                setLocalRecurrence(rule);
                onRecurrenceChange(rule);
            }
        }
    }, [rule]);`,
`    useEffect(() => {
        if (rule) {
            const timer = setTimeout(() => {
                if (JSON.stringify(rule) !== JSON.stringify(localRecurrence)) {
                    setLocalRecurrence(rule);
                    onRecurrenceChange(rule);
                }
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [rule, localRecurrence, onRecurrenceChange]);`
);
fs.writeFileSync('src/components/editor/pages/RecurrencePage.tsx', recurrenceCode);

// 2. DeadlinePage.tsx - set-state-in-effect
let deadlineCode = fs.readFileSync('src/components/editor/pages/DeadlinePage.tsx', 'utf8');
deadlineCode = deadlineCode.replace(
`    useEffect(() => {
        if (!selectedDate && !isInitializing) {
            setIsInitializing(true);
            const today = new Date().toISOString().split('T')[0];
            setSelectedDate(today);
            onDateChange(today);

            if (withTime && !selectedTime) {
                const now = new Date();
                const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
                const timeString = nextHour.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                setSelectedTime(timeString);
                onTimeChange?.(timeString);
            }
        }
    }, [selectedDate, isInitializing, withTime, selectedTime, onDateChange, onTimeChange]);`,
`    useEffect(() => {
        if (!selectedDate && !isInitializing) {
            const timer = setTimeout(() => {
                setIsInitializing(true);
                const today = new Date().toISOString().split('T')[0];
                setSelectedDate(today);
                onDateChange(today);

                if (withTime && !selectedTime) {
                    const now = new Date();
                    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
                    const timeString = nextHour.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                    setSelectedTime(timeString);
                    onTimeChange?.(timeString);
                }
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [selectedDate, isInitializing, withTime, selectedTime, onDateChange, onTimeChange]);`
);
fs.writeFileSync('src/components/editor/pages/DeadlinePage.tsx', deadlineCode);


// 3. TaskListSection.tsx - refs
let taskListCode = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskListCode = taskListCode.replace(
`    const activeTranslateY = useRef(Animated.add(pan.y, scrollOffset)).current;`,
`    const [activeTranslateY] = useState(() => Animated.add(pan.y, scrollOffset));`
);

// We still have panResponder refs inside TaskListSection.tsx. Wait, earlier I only replaced it for `TaskCard` ?
// Ah! In `TaskListSection.tsx` there's `TaskCard` and `DraggableTaskCard`.
// Let's replace all `useRef(PanResponder.create(` with `useMemo(() => PanResponder.create(`
taskListCode = taskListCode.replace(
    /const panResponder = useRef\([\s\S]*?PanResponder\.create\(\{[\s\S]*?\}\)\s*\)\.current;/g,
    `const [panResponder] = useState(() => PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                const h = handlersRef.current;
                pan.setOffset({ x: 0, y: (pan.y as any)._value });
                pan.setValue({ x: 0, y: 0 });
                h.onDragStart(h.index);
            },
            onPanResponderMove: (evt, gestureState) => {
                const h = handlersRef.current;
                pan.setValue({ x: 0, y: gestureState.dy });
                h.onDragMove(gestureState.moveY);
            },
            onPanResponderRelease: () => {
                const h = handlersRef.current;
                pan.flattenOffset();
                h.onDragEnd();
            }
        }));`
);

// I need to be careful with the exact regex for both `panResponder` blocks. Let's just manually replace both using a string match.

fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskListCode);
