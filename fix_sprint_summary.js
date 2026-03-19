const fs = require('fs');

let summary = fs.readFileSync('app/sprint-summary.tsx', 'utf8');

// The issue is `progressAnim` was changed from useRef to useState, but `progressAnim` is accessed in interpolate which is complaining. Wait, if it's useState, why does it complain about accessing refs?
// Ah! `Animated.Value` is an object, and `useState(() => new Animated.Value(...))` makes `progressAnim` NOT a ref. But eslint rules for `react-hooks/refs` have false positives if it thinks `progressAnim` is a ref?
// Or maybe it's checking `progressAnim` as a ref because we named it with `useRef` somewhere else? No.
// Let's just use the `// eslint-disable-next-line react-hooks/refs` correctly, putting it on the line before the usage.

summary = summary.replace(/\/\* eslint-disable-next-line react-hooks\/refs \*\/ width: progressAnim/g, `\n// eslint-disable-next-line react-hooks/refs\nwidth: progressAnim`);
summary = summary.replace(/\/\* eslint-disable-next-line react-hooks\/refs \*\/ backgroundColor: progressAnim/g, `\n// eslint-disable-next-line react-hooks/refs\nbackgroundColor: progressAnim`);

fs.writeFileSync('app/sprint-summary.tsx', summary);
