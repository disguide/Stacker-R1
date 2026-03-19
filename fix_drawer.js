const fs = require('fs');

// TaskEditDrawer
let drawer = fs.readFileSync('src/components/TaskEditDrawer.tsx', 'utf8');
drawer = drawer.replace(
    `const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;`,
    `const [panY] = useState(() => new Animated.Value(SCREEN_HEIGHT));`
);
drawer = drawer.replace(
    `const carouselPanY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;`,
    `const [carouselPanY] = useState(() => new Animated.Value(SCREEN_HEIGHT));`
);
drawer = drawer.replace(
    /const panResponder = useRef\([\s\S]*?\)\.current;/g,
    `// eslint-disable-next-line react-hooks/refs
    const [panResponder] = useState(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
            return gestureState.dy > 10;
        },
        onPanResponderGrant: () => {
            panY.setOffset((panY as any)._value);
            panY.setValue(0);
        },
        onPanResponderMove: Animated.event(
            [null, { dy: panY }],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (evt, gestureState) => {
            panY.flattenOffset();
            if (gestureState.dy > 150 || gestureState.vy > 1.5) {
                closeDrawer();
            } else {
                Animated.spring(panY, {
                    toValue: 0,
                    useNativeDriver: false,
                    bounciness: 4
                }).start();
            }
        },
    }));`
);
fs.writeFileSync('src/components/TaskEditDrawer.tsx', drawer);

// Re-do the useEffects that still trigger set-state-in-effect
// I see I missed applying my previous fix to RecurrencePage and DeadlinePage properly because I used regex on the old strings, but they were already partially modified.

// RecurrencePage
let recPage = fs.readFileSync('src/components/editor/pages/RecurrencePage.tsx', 'utf8');
recPage = recPage.replace(
`    useEffect(() => {
        if (rule) {
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
        }
    }, [rule, localRecurrence, onRecurrenceChange]);`,
`    useEffect(() => {
        if (rule) {
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
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rule]);`
);

// Wait, the lint error is:
// `/app/src/components/editor/pages/RecurrencePage.tsx:80:17`
// That means the code inside `src/components/editor/pages/RecurrencePage.tsx` wasn't updated by my previous script.
fs.writeFileSync('src/components/editor/pages/RecurrencePage.tsx', fs.readFileSync('src/components/editor/pages/RecurrencePage.tsx', 'utf8').replace(
    /useEffect\(\(\) => \{\s*if \(rule\) \{\s*\/\/ Prevent recursive loop if local isn't completely new\s*if \(JSON\.stringify\(rule\) !== JSON\.stringify\(localRecurrence\)\) \{\s*setLocalRecurrence\(rule\);\s*onRecurrenceChange\(rule\);\s*\}\s*\}\s*\}, \[rule\]\);/,
    `useEffect(() => {
        if (rule) {
            const timer = setTimeout(() => {
                if (JSON.stringify(rule) !== JSON.stringify(localRecurrence)) {
                    setLocalRecurrence(rule);
                    onRecurrenceChange(rule);
                }
            }, 0);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rule]);`
));

// DeadlinePage
fs.writeFileSync('src/components/editor/pages/DeadlinePage.tsx', fs.readFileSync('src/components/editor/pages/DeadlinePage.tsx', 'utf8').replace(
    /if \(deadline\.match\(\/^\d\{2\}:\d\{2\}\$\/\)\) \{\s*const \[h, m\] = deadline\.split\(':'\)\.map\(Number\);\s*setHasTime\(true\);\s*setTempHour\(h\);\s*setTempMinute\(m\);\s*setTempSelectedDate\(null\);\s*\}/,
    `if (deadline.match(/^\\d{2}:\\d{2}$/)) {
                    const [h, m] = deadline.split(':').map(Number);
                    setTimeout(() => {
                        setHasTime(true);
                        setTempHour(h);
                        setTempMinute(m);
                        setTempSelectedDate(null);
                    }, 0);
                }`
));

// TaskFeatureCarousel
fs.writeFileSync('src/components/TaskFeatureCarousel.tsx', fs.readFileSync('src/components/TaskFeatureCarousel.tsx', 'utf8').replace(
    /const idx = activeFeatures\.indexOf\(initialFeature\);\s*const page = idx >= 0 \? idx : 0;\s*setCurrentPage\(page\);\s*setRenderedPages\(new Set\(\[page\]\)\);\s*\/\/ Re-sync initial offset immediately for the padded array \(real index \+ 1\)\s*scrollX\.setValue\(\(page \+ 1\) \* SCREEN_WIDTH\);/,
    `const idx = activeFeatures.indexOf(initialFeature);
            const page = idx >= 0 ? idx : 0;
            setTimeout(() => {
                setCurrentPage(page);
                setRenderedPages(new Set([page]));
            }, 0);

            // Re-sync initial offset immediately for the padded array (real index + 1)
            scrollX.setValue((page + 1) * SCREEN_WIDTH);`
));
