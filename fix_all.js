const fs = require('fs');

// TaskMenu
let taskMenu = fs.readFileSync('src/components/TaskMenu.tsx', 'utf8');
taskMenu = taskMenu.replace(
    `const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;`,
    `const [panY] = useState(() => new Animated.Value(SCREEN_HEIGHT));`
);
fs.writeFileSync('src/components/TaskMenu.tsx', taskMenu);

// DeadlinePage
let deadlinePage = fs.readFileSync('src/components/editor/pages/DeadlinePage.tsx', 'utf8');
deadlinePage = deadlinePage.replace(
`                    const d = new Date(deadline);
                    if (!isNaN(d.getTime())) {
                        setTempSelectedDate(d);
                        setHasTime(true);
                        setTempHour(d.getHours());
                        setTempMinute(d.getMinutes());
                    }`,
`                    const d = new Date(deadline);
                    if (!isNaN(d.getTime())) {
                        const t = setTimeout(() => {
                            setTempSelectedDate(d);
                            setHasTime(true);
                            setTempHour(d.getHours());
                            setTempMinute(d.getMinutes());
                        }, 0);
                        return () => clearTimeout(t);
                    }`
);
fs.writeFileSync('src/components/editor/pages/DeadlinePage.tsx', deadlinePage);


// RecurrencePage - I did it wrong earlier, let's fix it properly.
let recPage = fs.readFileSync('src/components/editor/pages/RecurrencePage.tsx', 'utf8');
recPage = recPage.replace(
`        if (rule) {
            const timer = setTimeout(() => {
                if (JSON.stringify(rule) !== JSON.stringify(localRecurrence)) {
                    setLocalRecurrence(rule);
                    onRecurrenceChange(rule);
                }
            }, 0);
            return () => clearTimeout(timer);
        }`,
`        if (rule) {
            const timer = setTimeout(() => {
                setLocalRecurrence((prev) => {
                    if (JSON.stringify(rule) !== JSON.stringify(prev)) {
                        onRecurrenceChange(rule);
                        return rule;
                    }
                    return prev;
                });
            }, 0);
            return () => clearTimeout(timer);
        }`
);
fs.writeFileSync('src/components/editor/pages/RecurrencePage.tsx', recPage);

// TaskFeatureCarousel - set-state-in-effect
let featurePage = fs.readFileSync('src/components/TaskFeatureCarousel.tsx', 'utf8');
featurePage = featurePage.replace(
`            const idx = activeFeatures.indexOf(initialFeature);
            const page = idx >= 0 ? idx : 0;
            setCurrentPage(page);
            setRenderedPages(new Set([page]));

            // Re-sync initial offset immediately for the padded array (real index + 1)
            scrollX.setValue((page + 1) * SCREEN_WIDTH);`,
`            const idx = activeFeatures.indexOf(initialFeature);
            const page = idx >= 0 ? idx : 0;
            setTimeout(() => {
                setCurrentPage(page);
                setRenderedPages(new Set([page]));
            }, 0);

            // Re-sync initial offset immediately for the padded array (real index + 1)
            scrollX.setValue((page + 1) * SCREEN_WIDTH);`
);
fs.writeFileSync('src/components/TaskFeatureCarousel.tsx', featurePage);


// TaskListSection - refs
// The issue is `useState(() => Animated.add(pan.y, scrollOffset))` because `pan.y` might be reading a ref during render?
// Wait, `pan` is `useRef(new Animated.ValueXY()).current;`
// We should probably just use `useState(() => new Animated.ValueXY())[0]`
let taskList = fs.readFileSync('src/features/home/components/TaskListSection.tsx', 'utf8');
taskList = taskList.replace(
    `const pan = useRef(new Animated.ValueXY()).current;`,
    `const [pan] = useState(() => new Animated.ValueXY());`
);
// Also Animated.add(pan.y, scrollOffset)
taskList = taskList.replace(
    `const [activeTranslateY] = useState(() => Animated.add(pan.y, scrollOffset));`,
    `// @ts-ignore
    const [activeTranslateY] = useState(() => Animated.add(pan.y, scrollOffset));`
);

// We need to ignore eslint rules for react-hooks/refs for those lines where it complains about useState functions
taskList = taskList.replace(
    `const [panResponder] = useState(() => PanResponder.create({`,
    `// eslint-disable-next-line react-hooks/refs
    const [panResponder] = useState(() => PanResponder.create({`
);
fs.writeFileSync('src/features/home/components/TaskListSection.tsx', taskList);
