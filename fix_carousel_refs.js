const fs = require('fs');
let code = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');

// The replacement script in the previous step didn't match perfectly, so it failed. Let's do it using regex.
code = code.replace(/const carouselPanResponder = useRef\([\s\S]*?\)\.current;/g, `const carouselPanResponder = useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            // Only capture strong UPWARD movement logic (in bubbling phase to let wheels scroll)
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                return gestureState.dy > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderGrant: () => {
                carouselPanY.setOffset((carouselPanY as any)._value);
                carouselPanY.setValue(0);
            },
            onPanResponderMove: Animated.event(
                [null, { dy: carouselPanY }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (evt, gestureState) => {
                carouselPanY.flattenOffset();
                if (gestureState.dy > 150 || gestureState.vy > 1.5) {
                    // Dragged down far enough or fast enough to close
                    closeAndSave();
                } else {
                    // Spring back to top
                    Animated.spring(carouselPanY, {
                        toValue: 0,
                        useNativeDriver: false,
                        bounciness: 4
                    }).start();
                }
            },
        }), [carouselPanY]);`
);
// Fix the dependency of closeAndSave to include it in the useMemo
// Actually closeAndSave is defined AFTER the useMemo, so we can't use it directly in useMemo unless we move it or use a ref.
// Let's replace the whole file's hook order or just use useState.

const fileCode = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
const fixedCarousel = fileCode.replace(/const carouselPanResponder = useRef\([\s\S]*?\)\.current;/g, `const carouselPanResponder = useState(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                return gestureState.dy > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderGrant: () => {
                carouselPanY.setOffset((carouselPanY as any)._value);
                carouselPanY.setValue(0);
            },
            onPanResponderMove: Animated.event(
                [null, { dy: carouselPanY }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (evt, gestureState) => {
                carouselPanY.flattenOffset();
                if (gestureState.dy > 150 || gestureState.vy > 1.5) {
                    // Workaround to access latest closeAndSave
                    closeAndSaveRef.current?.();
                } else {
                    Animated.spring(carouselPanY, {
                        toValue: 0,
                        useNativeDriver: false,
                        bounciness: 4
                    }).start();
                }
            },
        })
    )[0];`);

const withCloseRef = fixedCarousel.replace(`    const carouselPanY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;`, `    const carouselPanY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const closeAndSaveRef = useRef<() => void>();`);

const withCloseUpdate = withCloseRef.replace(`    const closeAndSave = () => {`, `    const closeAndSave = () => {
        // save edited fields ...`);

// Actually closeAndSave is already defined. Let's just update the ref on every render.
const finalCode = withCloseRef.replace(/const closeAndSave = \(\) => {/g, `const closeAndSave = () => {
`);

fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', finalCode);

// Add the ref assignment before the closeAndSave
const injectAssignment = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');
fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', injectAssignment.replace(`    const closeAndSave = () => {`, `    const closeAndSave = () => {
        closeAndSaveRef.current = undefined; // satisfy linter if we must, actually we need to assign it.
    };
    closeAndSaveRef.current = () => {`));
