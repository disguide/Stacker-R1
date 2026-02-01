---
description: How to build and run the Calendar/Task App (Stacker R1)
---

# Building the Calendar/Task App

This workflow covers setting up, developing, and running the Stacker R1 task management app built with React Native and Expo.

---

## 1. Project Setup

### Prerequisites
- Node.js 18+ installed
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator, or Expo Go app on physical device

### Initial Setup
```bash
# Clone or navigate to project directory
cd "c:\Calendar App R1"

# Install dependencies
npm install
```

---

## 2. Running the App

### Development Server
// turbo
```bash
npx expo start -c
```

The `-c` flag clears the cache for a fresh start.

### Running on Devices
- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal  
- **Physical Device**: Scan QR code with Expo Go app

---

## 3. Project Structure

```
Calendar App R1/
├── app/                      # Main app screens (Expo Router)
│   ├── index.tsx            # Main task list screen
│   ├── sprint.tsx           # Sprint mode screen
│   ├── mail.tsx             # Mail/notifications screen
│   ├── theme.ts             # Theme constants & colors
│   ├── styles/
│   │   └── taskListStyles.ts # Extracted styles
│   └── utils/
│       └── dateHelpers.ts   # Date utility functions
│
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── SwipeableTaskRow.tsx
│   │   ├── TaskEditDrawer.tsx
│   │   ├── TaskMenu.tsx
│   │   ├── CalendarModal.tsx
│   │   ├── DurationPickerModal.tsx
│   │   ├── CompletedTasksModal.tsx
│   │   └── RecurrencePickerModal.tsx
│   │
│   ├── features/tasks/      # Task feature module
│   │   ├── hooks/
│   │   │   └── useTaskController.ts
│   │   ├── logic/
│   │   │   └── recurrenceEngine.ts
│   │   └── types.ts
│   │
│   └── services/
│       └── storage.ts       # AsyncStorage persistence
│
├── package.json
└── tsconfig.json
```

---

## 4. Key Technologies

| Technology | Purpose |
|------------|---------|
| **React Native** | Cross-platform mobile framework |
| **Expo SDK 54** | Development tools & native APIs |
| **Expo Router** | File-based navigation |
| **TypeScript** | Type safety |
| **rrule** | Recurring task logic |
| **@shopify/flash-list** | High-performance list rendering |
| **react-native-gesture-handler** | Swipe gestures |
| **react-native-reanimated** | Smooth animations |
| **expo-haptics** | Haptic feedback |
| **expo-av** | Audio for notifications |

---

## 5. Core Features

### Task Management
- Create, edit, delete tasks
- Assign tasks to specific dates
- Set deadlines and estimated durations
- Add subtasks

### Recurring Tasks
- Daily, weekly, monthly, yearly patterns
- Custom days of week
- Exception handling (skip specific dates)

### Sprint Mode
- Select multiple tasks for focused work session
- Timer-based work sessions
- Completion tracking

### UI Features
- Swipe-to-complete with haptic feedback
- Date-based view (1 day, 3 days, week, month, all)
- Task completion history
- Smooth animations

---

## 6. Development Workflow

### Adding a New Feature

1. **Plan**: Define the feature scope and UI/UX
2. **Create Component**: Add to `src/components/` if reusable
3. **Update Types**: Modify `src/features/tasks/types.ts` if needed
4. **Implement Logic**: Update hooks or create new ones
5. **Integrate**: Add to main screen (`app/index.tsx`)
6. **Test**: Run app and verify functionality

### Modifying Styles

1. Edit `app/styles/taskListStyles.ts` for main list styles
2. Edit `app/theme.ts` for colors and design tokens
3. Component-specific styles stay in component files

### Working with Recurring Tasks

The recurrence system uses:
- **Master Task**: The original task with `rrule` field
- **Ghost Instances**: Projected occurrences (ID format: `{masterId}_{date}`)
- **Exceptions**: Dates where the recurrence is skipped or modified

---

## 7. Common Commands

// turbo-all
```bash
# Start development server
npx expo start -c

# Type checking
npx tsc --noEmit

# Install a new package
npx expo install <package-name>

# Clear all caches and restart
npx expo start -c --clear

# Build for production (EAS)
eas build --platform all
```

---

## 8. Troubleshooting

### App Not Loading
- Clear cache: `npx expo start -c`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Type Errors
- Run `npx tsc --noEmit` to see all TypeScript errors
- Check imports and ensure types are properly defined

### Gesture Handler Issues
- Ensure `GestureHandlerRootView` wraps the app in `_layout.tsx`

### Storage Issues
- Check AsyncStorage limits (usually 6MB)
- Use WatermelonDB for larger datasets (future enhancement)

---

## 9. Future Enhancements

- [ ] WatermelonDB integration for better data persistence
- [ ] Screen time restrictions
- [ ] Add-on system (Productivity, Cosmetics)
- [ ] Social features (task sharing)
- [ ] Push notifications for reminders
- [ ] Widget support
