# Stacker R2 Rulebook

> Coding standards, conventions, and rules for developing the Stacker R2 app.

---

## 📁 File Organization Rules

### R1: Screen files go in `app/`
All screen components must be placed in the `app/` directory for Expo Router.

```
✅ app/index.tsx
✅ app/sprint.tsx
✅ app/settings.tsx
❌ src/screens/HomeScreen.tsx
```

### R2: Reusable components go in `src/components/`
Any component used in multiple places belongs in the shared components folder.

```
✅ src/components/TaskEditDrawer.tsx
✅ src/components/SwipeableTaskRow.tsx
❌ app/components/Button.tsx
```

### R3: Feature logic stays in `src/features/`
Business logic, hooks, and types for specific features stay in feature folders.

```
src/features/tasks/
├── hooks/          # Custom hooks
├── logic/          # Pure business logic
└── types.ts        # TypeScript interfaces
```

### R4: Extract large files when they exceed 500 lines
When a file grows beyond 500 lines, extract into smaller modules:
- Styles → `styles/` folder
- Helpers → `utils/` folder
- Constants → `theme.ts` or dedicated file

---

## 🎨 Styling Rules

### R5: Always use THEME constants for colors
Never hardcode color values. Use the theme.

```typescript
// ✅ Good
backgroundColor: THEME.bg

// ❌ Bad
backgroundColor: '#F8FAFC'
```

### R6: Use StyleSheet.create for styles
Avoid inline style objects for performance.

```typescript
// ✅ Good
<View style={styles.container} />

const styles = StyleSheet.create({
  container: { flex: 1 }
});

// ❌ Bad
<View style={{ flex: 1 }} />
```

### R7: Group related styles together
Organize styles by component section with comments.

```typescript
const styles = StyleSheet.create({
  // Header
  header: { ... },
  headerTitle: { ... },
  
  // Task List
  taskList: { ... },
  taskCard: { ... },
});
```

---

## 📝 Naming Conventions

### R8: Use PascalCase for components
```typescript
// ✅ Good
function TaskEditDrawer() {}
export default SwipeableTaskRow;

// ❌ Bad
function taskEditDrawer() {}
export default swipeableTaskRow;
```

### R9: Use camelCase for functions and variables
```typescript
// ✅ Good
const handleAddTask = () => {};
const isCompleted = true;

// ❌ Bad
const HandleAddTask = () => {};
const is_completed = true;
```

### R10: Use UPPER_SNAKE_CASE for constants
```typescript
// ✅ Good
const THEME = { ... };
const VIEW_CONFIG = { ... };
const MAX_RETRY_COUNT = 3;

// ❌ Bad
const theme = { ... };
const viewConfig = { ... };
```

### R11: Prefix boolean variables with `is`, `has`, `should`, `can`
```typescript
// ✅ Good
const isLoading = true;
const hasSubtasks = task.subtasks.length > 0;
const shouldAutoSave = true;
const canDelete = !isRecurring;

// ❌ Bad
const loading = true;
const subtasks = task.subtasks.length > 0;
```

### R12: Prefix handler functions with `handle` or action verb
```typescript
// ✅ Good
const handleAddTask = () => {};
const handleConfirmDelete = () => {};
const toggleSubtask = () => {};
const openEditDrawer = () => {};

// ❌ Bad
const addTaskClick = () => {};
const deleteIt = () => {};
```

---

## 🔄 State Management Rules

### R13: Use `useState` for local UI state
```typescript
const [isVisible, setIsVisible] = useState(false);
const [inputValue, setInputValue] = useState('');
```

### R14: Use `useRef` for values that shouldn't trigger re-renders
```typescript
const inputRef = useRef<TextInput>(null);
const timeoutRef = useRef<NodeJS.Timeout | null>(null);
```

### R15: Use `useMemo` for expensive calculations
```typescript
// ✅ Good - recalculates only when dependencies change
const calendarItems = useMemo(() => {
  return RecurrenceEngine.generateCalendarItems(tasks, startDate, days);
}, [tasks, startDate, days]);

// ❌ Bad - recalculates on every render
const calendarItems = RecurrenceEngine.generateCalendarItems(tasks, startDate, days);
```

### R16: Keep state as close to usage as possible
Don't lift state higher than necessary.

---

## 🔁 Recurring Tasks Rules

### R17: Never mutate ghost instances directly
Always resolve to master task ID before updating.

```typescript
// ✅ Good
const masterId = parseGhostId(ghostId).masterId;
updateTask(masterId, { title: "New Title" });

// ❌ Bad
updateTask(ghostId, { title: "New Title" });
```

### R18: Ghost ID format must be `{masterId}_{YYYY-MM-DD}`
```typescript
const ghostId = `${masterId}_${dateString}`;
// Example: "abc123_2026-01-30"
```

### R19: Use `completedDates` array for recurring task completion
```typescript
// Track which dates a recurring task was completed
task.completedDates = ["2026-01-28", "2026-01-29"];
```

### R20: Use `exceptionDates` array for skipped occurrences
```typescript
// Track which dates a recurring task should be skipped
task.exceptionDates = ["2026-02-01"];
```

---

## 📅 Date Handling Rules

### R21: Store dates as ISO strings (YYYY-MM-DD)
```typescript
// ✅ Good
task.date = "2026-01-30";
task.deadline = "2026-01-30T14:00";

// ❌ Bad
task.date = new Date();
task.deadline = 1706612400000;
```

### R22: Use helper functions for date formatting
```typescript
import { toISODateString, formatDeadline } from './utils/dateHelpers';

const dateStr = toISODateString(new Date());
const display = formatDeadline(task.deadline);
```

### R23: Always normalize dates to local timezone for display
Be careful with Date objects and timezone handling.

---

## 🧩 Component Rules

### R24: Components must have TypeScript props interface
```typescript
interface TaskRowProps {
  id: string;
  title: string;
  completed: boolean;
  onComplete: () => void;
}

export default function TaskRow({ id, title, completed, onComplete }: TaskRowProps) {
  // ...
}
```

### R25: Use optional chaining for possibly undefined props
```typescript
// ✅ Good
const hasSubtasks = task.subtasks?.length > 0;
item.subtasks?.forEach(sub => { ... });

// ❌ Bad (may crash)
const hasSubtasks = task.subtasks.length > 0;
```

### R26: Provide default values for optional props
```typescript
interface Props {
  title: string;
  subtitle?: string;
  showIcon?: boolean;
}

function Component({ title, subtitle = '', showIcon = false }: Props) {
  // ...
}
```

---

## ⚡ Performance Rules

### R27: Use FlashList for long lists (>20 items)
```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  estimatedItemSize={80}
  renderItem={({ item }) => <ItemRow item={item} />}
/>
```

### R28: Avoid creating functions inside render
```typescript
// ✅ Good - function defined outside
const handlePress = useCallback(() => {
  doSomething(item.id);
}, [item.id]);

<Button onPress={handlePress} />

// ❌ Bad - new function every render
<Button onPress={() => doSomething(item.id)} />
```

### R29: Use `React.memo` for pure list items
```typescript
const TaskRow = React.memo(function TaskRow({ task, onComplete }) {
  return <View>...</View>;
});
```

---

## 🔒 Data Persistence Rules

### R30: Always await async storage operations
```typescript
// ✅ Good
await StorageService.saveTasks(tasks);

// ❌ Bad - may not complete
StorageService.saveTasks(tasks);
```

### R31: Handle storage errors gracefully
```typescript
try {
  await StorageService.saveTasks(tasks);
} catch (error) {
  console.error('Failed to save tasks:', error);
  // Show user-friendly error message
}
```

### R32: Validate data when loading from storage
```typescript
const loadedTasks = await StorageService.loadTasks();
const validTasks = loadedTasks.filter(task => 
  task.id && task.title && task.date
);
```

---

## 🎯 Code Quality Rules

### R33: No console.log in production code
Use console.log for debugging only. Remove or convert to proper logging before committing.

```typescript
// ✅ Good for debugging (remove before commit)
// console.log('Debug:', value);

// ❌ Bad in committed code
console.log('Task added');
```

### R34: Handle all error cases
```typescript
// ✅ Good
if (!task) {
  console.warn('Task not found:', taskId);
  return;
}

// ❌ Bad - may crash on undefined
updateTask(task.id, updates);
```

### R35: Use TypeScript strict mode
Never use `any` type unless absolutely necessary.

```typescript
// ✅ Good
const task: Task = ...;
const items: CalendarItem[] = ...;

// ❌ Bad
const task: any = ...;
```

### R36: Comment complex logic
```typescript
// ✅ Good
// Parse ghost ID to extract master ID and date
// Format: "{masterId}_{YYYY-MM-DD}"
if (taskId.includes('_')) {
  const parts = taskId.split('_');
  // ...
}

// ❌ Bad - no explanation for complex logic
if (taskId.includes('_')) {
  const parts = taskId.split('_');
  // ...
}
```

---

## ✅ Pre-Commit Checklist

Before committing code, verify:

- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] App loads without crashes
- [ ] New features work as expected
- [ ] Existing features still work
- [ ] No hardcoded colors (use THEME)
- [ ] No console.log statements left
- [ ] Components have proper TypeScript types
- [ ] Complex logic has comments

---

## 📚 Quick Reference

| Category | Convention |
|----------|------------|
| Components | PascalCase: `TaskRow` |
| Functions | camelCase: `handleAddTask` |
| Constants | UPPER_SNAKE: `THEME` |
| Booleans | Prefixed: `isLoading` |
| Handlers | Prefixed: `handleClick` |
| Files | kebab-case or camelCase |
| Dates | ISO string: `YYYY-MM-DD` |
| Ghost IDs | `{masterId}_{date}` |
