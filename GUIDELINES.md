# Project Guidelines: Stacker R1

## 1. Project Overview
Stacker R1 is a mobile application designed to be a high-performance replica of **Google Tasks** with a unique productivity engine called **"Sprint Mode."**

### Core Value Proposition
- **Familiarity:** Mimics the clean, list-based interface of Google Tasks.
- **Focus:** The "Sprint" feature allows users to select specific tasks and enter a dedicated "locked-in" UI until those tasks are completed.
- **Discipline:** Future updates will integrate screen time restrictions to prevent distractions during Sprints.

## 2. Technology Stack (Best-in-Class Selection)
To achieve a native-feeling, high-performance replica, we will use the following stack:

- **Framework:** **React Native (via Expo)**
  - *Why:* Rapid development, excellent cross-platform support, and easy access to native modules for future screen time features.
- **Language:** **TypeScript**
  - *Why:* Essential for maintainability and preventing bugs in complex state logic (like Sprint sessions).
- **State Management:** **Zustand**
  - *Why:* Simpler and faster than Redux, perfect for managing the global "Sprint State" (active tasks, timer status) and persisting it effortlessly.
- **Local Database:** **react-native-mmkv** (or WatermelonDB)
  - *Why:* `mmkv` is the fastest key-value storage for mobile, ensuring instant load times for task lists.
- **Animations & Gestures:** **React Native Reanimated** + **Gesture Handler**
  - *Why:* Critical for replicating the smooth drag-and-drop and swipe-to-complete interactions found in Google Tasks.
- **Advanced Graphics (Optional):** **React Native Skia**
  - *Why:* Provides high-performance 2D graphics (blur, gradients, morphing shapes) to ensure **ZERO design limitations**.
- **Navigation:** **Expo Router**
  - *Why:* File-based routing that makes handling the transition to the "Sprint Screen" seamless.

## 3. Product Features & Architecture

### A. The "Google Tasks" Replica core
- **Top Navigation Bar:**
  - **Top Left:** Profile.
  - **Top Right:** Settings.
  - **Toolbar Items:** Inbox Mail, Friends, Today Button.
- Minimalist list view.
- Drag-and-drop sorting.
- Subtasks and date categorization.
- "Add Task" bottom sheet interaction.

### B. Sprint Mode (Detailed Flow)
1.  **Selection:** Toggle "Sprint" -> Select multiple tasks from Main List -> Start.
2.  **Active Sprint UI:**
    -   **Upper Middle:** Current Task displayed **LARGE**.
    -   **Top Right Buttons:**
        -   **Breaks:** Time off logic (capped at 15 mins).
        -   **Undo:** Revert last action.
    -   **Action Buttons (Location TBD):**
        -   **Switch Tasks**
        -   **Switch Parts**
        -   **Complete**
    -   **Bottom:** The remaining list of selected tasks.
3.  **Post-Sprint Summary:**
    -   Shows total work time & duration per task.
    -   Option to **deselect** tasks (mark incomplete).
    -   **"Save as Best Day":** Saves performance to Archive (in Profile).

### C. Add-on Architecture (to be implemented later once the core is finished and functional)
The app core is extended by:
-   **Productivity Add-on:** Advanced features.
-   **Cosmetics Add-on:** Themes and aesthetic customizations.

## 4. Design Philosophy
- **Aesthetics:** **Pure Light Mode** – Clean white backgrounds, crisp black text. Single default theme.
- **Interaction:** Haptic feedback (using `expo-haptics`) on every completion and selection.


## 4. Coding Standards
- Use functional components with Hooks.
- Ensure strict typing (if using TypeScript).
- Keep components small and focused.
- Use meaningful variable and function names.

## 5. Directory Structure
(Proposed Structure)
- `/src`
  - `/components` - Reusable UI components
  - `/screens` - Screen definitions
  - `/navigation` - Navigation configuration
  - `/hooks` - Custom React hooks
  - `/constants` - Theme colors, config values
  - `/utils` - Helper functions

## 6. Git Workflow


## 7. Operations & Roadmap

### Operational Approach
We will build **Iteratively**:
1.  **Skeleton First:** implementing the navigation and empty screens to verify flow.
2.  **Breadth-First Implementation:** Building all "Static" UI (Frontend) before adding "Logic" (Backend/State).
3.  **Component Isolation:** Building complex UI elements (like the Task Item) in isolation before integrating them.

### Goals to Achieve (The Roadmap)

#### Phase 1: The Blank Canvas (Goal: "Clean Start")
- [ ] Initialize Project (Expo/TypeScript).
- [ ] Ensure a clean, blank white screen runs on the simulator.

#### Phase 2: The Visual Skeleton (Goal: "Layout First")
- [ ] Place **Non-functional** UI elements: Profile, Settings, Bottom Nav.
- [ ] Establish the spatial layout without logic.

#### Phase 3: The Task Engine (Challenges 1 & 2)
**Challenge 1: The Logic**
- [ ] Deadlines & Reminders.
- [ ] Recurrence Systems (Daily/Weekly).
- [ ] Deadlines & Reminders.
- [ ] Recurrence Systems (Daily/Weekly).
- [ ] Data Model & Persistence (Split Storage Strategy).

### D. Data Strategy (Active vs. History)
To ensure maximum performance over years of usage, Stacker R1 employs a "Split Storage" strategy:
1.  **Active Storage (`@stacker_active`)**: Only contains incomplete tasks. Loaded instantly on app launch. Keeps the main UI snappy.
2.  **History Storage (`@stacker_history`)**: Contains all completed and deleted tasks. ONLY loaded when the History Modal is opened.
3.  **Archiving (Future Feature)**:
    -   Daily performance (tasks completed, sprint times) will be aggregated into a "Best Day" metric.
    -   This allows for long-term analytics ("Sprint Performance") without bogging down the daily task list.

**Challenge 2: The UI**
- [ ] Viewing & Organization (List View).
- [ ] Editing & Parameters Controls.
- [ ] Swipe/Drag Interactivity.

#### Phase 4: The Sprint System (Challenge 3)
**Challenge 3: The Sprint**
- [ ] Selection Core.
- [ ] Active Sprint UI (5 Buttons, Large Task).
- [ ] Timer, Breaks, and Summary Logic.

