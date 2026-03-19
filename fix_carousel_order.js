const fs = require('fs');
let code = fs.readFileSync('src/features/tasks/components/TaskEditCarousel.tsx', 'utf8');

code = code.replace(
`    useEffect(() => {
        closeAndSaveRef.current = closeAndSave;
    });

    const closeAndSave = () => {`,
`    const closeAndSave = () => {`
);

// add the effect AFTER closeAndSave
code = code.replace(
`    if (!activeFeature) return null;`,
`    useEffect(() => {
        closeAndSaveRef.current = closeAndSave;
    });

    if (!activeFeature) return null;`
);

fs.writeFileSync('src/features/tasks/components/TaskEditCarousel.tsx', code);
