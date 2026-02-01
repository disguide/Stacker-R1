---
name: Stacker R1 Development
description: Guidelines and patterns for developing the Stacker R1 task management app
---

# Stacker R1 Development Skill

This skill provides comprehensive guidance for working with the Stacker R1 codebase - a React Native task management app built with Expo.

---

## App Overview

**Stacker R1** is a date-based task management app with:
- Task scheduling by date
- Recurring task support (daily, weekly, monthly, yearly)
- Sprint mode for focused work sessions
- Swipe-to-complete gestures
- Subtask support
- Task history and restoration

---

## Architecture

### File Organization

```
app/                          # Expo Router screens
├── index.tsx                 # Main task list (primary screen)
├── sprint.tsx                # Sprint mode timer screen
├── mail.tsx                  # Notifications/mail screen
├── _layout.tsx               # Root layout with providers
├── theme.ts                  # Design tokens & theme constants
├── styles/
│   └── taskListStyles.ts     # Extracted StyleSheet for index.tsx
└── utils/
    └── dateHelpers.ts        # Date formatting utilities

src/                          # Feature modules & shared code
├── components/               # Reusable UI components
├── features/tasks/           # Task domain logic
│   ├── hooks/               # Custom hooks
│   ├── logic/               # Business logic
│   └── types.ts             # TypeScript types
└── services/                 # Data persistence
```

### Key Files Reference

| File | Purpose | When to Modify |
|------|---------|----------------|
| `app/index.tsx` | Main task list screen | Adding UI features to main screen |
| `app/theme.ts` | Colors, design tokens | Changing app appearance |
| `app/styles/taskListStyles.ts` | Main screen styles | Modifying task list styling |
| `app/utils/dateHelpers.ts` | Date utilities | Adding date formatting |
| `src/features/tasks/types.ts` | Task/Subtask types | Adding task properties |
| `src/features/tasks/hooks/useTaskController.ts` | Task CRUD operations | Modifying task logic |
| `src/features/tasks/logic/recurrenceEngine.ts` | Recurring task projection | Modifying recurrence behavior |
| `src/services/storage.ts` | AsyncStorage persistence | Changing data storage |

---

## Core Patterns

### 1. Task Data Model

```typescript
interface Task {
  id: string;                    // Unique identifier
  title: string;                 // Task title
  date: string;                  // Start date (YYYY-MM-DD)
  completed: boolean;            // Completion status (single tasks)
  completedDates: string[];      // Dates where recurring task was completed
  exceptionDates: string[];      // Dates to skip for recurring tasks
  deadline?: string;             // Optional deadline (YYYY-MM-DD or YYYY-MM-DDTHH:mm)
  estimatedTime?: string;        // Duration string (e.g., "30m", "1h 30m")
  rrule?: string;                // RRule string for recurrence
  subtasks?: Subtask[];          // Child tasks
  progress?: number;             // 0-100 completion percentage
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  deadline?: string;
  estimatedTime?: string;
  progress?: number;
}
```

### 2. Recurring Task Pattern (Master-Ghost)

Recurring tasks use a **Master-Ghost** pattern:

- **Master Task**: The original task stored in database with `rrule` field
- **Ghost Instances**: Virtual projections for each occurrence date
- **Ghost ID Format**: `{masterId}_{YYYY-MM-DD}`

```typescript
// Parsing a ghost ID to get master ID
const parseGhostId = (ghostId: string) => {
  if (ghostId.includes('_')) {
    const parts = ghostId.split('_');
    const potentialDate = parts[parts.length - 1];
    if (potentialDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return {
        masterId: parts.slice(0, -1).join('_'),
        date: potentialDate,
        isGhost: true
      };
    }
  }
  return { masterId: ghostId, date: null, isGhost: false };
};
```

### 3. State Management Pattern

The app uses React's built-in state with a custom hook pattern:

```typescript
// In components - use the controller hook
const { tasks, loading, addTask, toggleTask, deleteTask, updateTask } = useTaskController();

// The hook handles:
// - Loading tasks from storage
// - Saving changes to storage
// - Providing CRUD operations
```

### 4. Component Composition

UI components receive data and callbacks as props:

```typescript
<SwipeableTaskRow
  id={task.id}
  title={task.title}
  completed={task.completed}
  onComplete={() => handleComplete(task.id)}
  onEdit={() => openEditDrawer(task)}
  onMenu={() => openMenu(task)}
  // ... other props
/>
```

---

## Styling Guidelines

### Theme Constants

Always use theme constants from `app/theme.ts`:

```typescript
import { THEME } from './theme';

// Use theme values
backgroundColor: THEME.bg,        // #F8FAFC
color: THEME.textPrimary,         // #1E293B
borderColor: THEME.border,        // #333333
```

### Style Organization

- **Global styles**: `app/styles/taskListStyles.ts`
- **Component styles**: Inline in component files
- **Theme tokens**: `app/theme.ts`

### Common Style Patterns

```typescript
// Card with shadow
cardStyle: {
  backgroundColor: THEME.surface,
  borderRadius: 12,
  padding: 16,
  shadowColor: THEME.shadowColor,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
}

// Interactive button
buttonStyle: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
  backgroundColor: THEME.accent,
}
```

---

## Adding New Features

### Adding a New Task Property

1. **Update types** in `src/features/tasks/types.ts`:
   ```typescript
   interface Task {
     // existing properties...
     newProperty?: string;
   }
   ```

2. **Update storage** in `src/services/storage.ts` if needed

3. **Update UI** in relevant components

4. **Update edit drawer** in `src/components/TaskEditDrawer.tsx`

### Adding a New Screen

1. Create file in `app/` directory (e.g., `app/settings.tsx`)

2. Export default component:
   ```typescript
   export default function SettingsScreen() {
     return <SafeAreaView>...</SafeAreaView>;
   }
   ```

3. Navigate using Expo Router:
   ```typescript
   import { useRouter } from 'expo-router';
   const router = useRouter();
   router.push('/settings');
   ```

### Adding a New Component

1. Create in `src/components/`:
   ```typescript
   // src/components/MyComponent.tsx
   import { View, Text } from 'react-native';
   
   interface MyComponentProps {
     title: string;
     onPress: () => void;
   }
   
   export default function MyComponent({ title, onPress }: MyComponentProps) {
     return (
       <View>
         <Text>{title}</Text>
       </View>
     );
   }
   ```

2. Import and use in screens

---

## Common Operations

### Working with Dates

```typescript
import { toISODateString, isToday, getDayName, formatDeadline } from './utils/dateHelpers';

// Convert Date to string
const dateStr = toISODateString(new Date()); // "2026-01-30"

// Check if date is today
const isTodayDate = isToday(someDate); // true/false

// Get day name
const dayName = getDayName(someDate); // "Monday"

// Format deadline for display
const display = formatDeadline("2026-01-30T14:00"); // "Jan 30, 2:00 PM"
```

### Working with Recurrence (RRule)

```typescript
import { RRule } from 'rrule';

// Create a weekly recurrence
const rule = new RRule({
  freq: RRule.WEEKLY,
  interval: 1,
  dtstart: new Date('2026-01-30'),
  byweekday: [RRule.MO, RRule.WE, RRule.FR]
});

const rruleString = rule.toString();

// Parse existing rrule
const parsedRule = RRule.fromString(rruleString);
const nextOccurrences = parsedRule.between(startDate, endDate);
```

### Task Operations

```typescript
// Add task
addTask({
  id: Date.now().toString(),
  title: "New Task",
  date: "2026-01-30",
  completedDates: [],
  exceptionDates: [],
  subtasks: [],
  progress: 0
});

// Update task
updateTask(taskId, { 
  title: "Updated Title",
  deadline: "2026-02-01"
});

// Toggle completion
toggleTask(taskId, dateString);

// Delete task
deleteTask(taskId, dateString, 'all' | 'single' | 'future');
```

---

## Testing Checklist

When making changes, verify:

- [ ] App loads without errors
- [ ] Tasks can be created
- [ ] Tasks can be completed (tap checkbox)
- [ ] Tasks can be edited (open drawer)
- [ ] Tasks can be deleted
- [ ] Subtasks work correctly
- [ ] Recurring tasks project correctly
- [ ] Sprint mode selection works
- [ ] Navigation between dates works
- [ ] Swipe gestures work smoothly

---

## Performance Tips

1. **Use FlashList** instead of FlatList for long lists
2. **Memoize expensive calculations** with `useMemo`
3. **Avoid inline functions** in render for frequently updating components
4. **Use `React.memo`** for pure components that don't need re-renders

---

## Troubleshooting

### "Cannot find module" errors
- Check import paths are correct
- Run `npx tsc --noEmit` for TypeScript errors

### Gesture handler not working
- Ensure `GestureHandlerRootView` wraps app in `_layout.tsx`

### Tasks not persisting
- Check `StorageService` in `src/services/storage.ts`
- Verify AsyncStorage is working

### Recurring tasks not showing
- Check `RecurrenceEngine.generateCalendarItems()` in `src/features/tasks/logic/recurrenceEngine.ts`
- Verify `rrule` string format is valid
