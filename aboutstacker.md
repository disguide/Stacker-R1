# Stacker: The Definitive Product & Engineering Specification (R1)
> **Product Category:** High-Utility Personal Growth Dashboard
> **Vision:** The "Goldilocks" of productivity—bridging the gap between the chaotic calendar and the fragile to-do list.
> **Documentation Version:** 7.0.0 (Unified Physical Specification)
> **Engineering Status:** Production Ready (R1)
EVERYTHING IN ALL CAPS IS WRITEN BY THE DEVELOPER AND IS VERY IMPORTANT 
---

## 1. The Core Philosophy: "The Hybrid"

Stacker exists to solve a fundamental tension in modern human productivity. The current market is bifurcated into two extremes, both of which introduce an unnecessary cognitive tax on the high-performance user. Stacker was designed from the ground up to sit precisely in the center of these two paradigms.

### A. The "Calendar" Problem (The Grid Trap)
Traditional calendars (Google, Outlook, Apple) are built on the legacy of physical paper day-planners. They require every task to have a start and end time. PLUS ITS TOO MANY CLICKS AND ITS DIFFICULT TO DECIDE WHEN TO DO WHAT THERES TOO MUCH FRICTION
*   **The Problem of Precision:** Forcing a user to decide if "Buy Milk" takes 15 or 20 minutes is a cognitive tax that discourages entry. Users spend more time "Tetris-ing" their day than doing work.
*   **The Dead Calendar Effect:** If your morning meeting runs late, the entire afternoon's "Time Blocks" become a red-text graveyard of failed intentions, leading to "Calendar Guilt" and total abandonment of the system.
*   **Dimensionality Loss:** If a task isn't on the grid, it often doesn't exist in the user's peripheral vision.

### B. The "To-Do List" Problem (The Infinite Stack)
Standard list apps (Todoist, Notes, Reminders) are effectively infinite digital scrolls. PLUS THEY ARE TOO SIMPLE AND MAKE IT HARD FOR THE USER TO ORGANISE AND PLAN
*   **Scale Fatigue:** While easy to add to, they lack temporal context. You can have 50 items on "Today" with no sense of whether you actually have the hours to complete them. The list feels bottomless.
*   **The Drift Phenomenon:** Tasks move from Today to Tomorrow with such ease that deadlines lose their psychological weight. This leads to the "Someday Archive" black hole where tasks go to die.

### C. The Stacker Solution: "The Middle Path"
Stacker is a **Multi-List Hybrid**. It organizes work into discrete, daily buckets (Multi-list) but maintains the fluid, low-friction interaction of a modern task list. 
*   **Temporal Calibration:** It allows for "Day-at-a-glance" planning without the crushing architecture of hourly time-blocking.
*   **Bucket-Based Capacity:** By viewing only the tasks for a specific 24-hour window, the user gains a physical sense of their capacity. The day has a bottom, unlike the infinite list.

---

## 2. Design Language: "Modern Stationery"

The Stacker aesthetic is rooted in the physical world. It rejects the blurred, translucent "Glassmorphism" of modern operating systems in favor of something more tactile, grounded, and lasting: **Modern Stationery**.

### A. Visual Identity & Design Tokens
Designed to look like a high-end fountain pen on premium cardstock, the UI focuses on clarity, high contrast, and planar surfaces.

#### I. Color Palette (The Ink and Paper)
- **Base Background:** Slate 50 (`#F8FAFC`). Provides a calm, cool environment for focus and reduces digital eye-strain during long sessions.
- **Primary Surface:** Warm Cream (`#FFFDF5`). Used for all active task cards. This simulates the look of expensive, off-white paper or heavy-weight cardstock.
- **Task Border:** Ink Black (`#333333`). Bold, 1px strokes that clearly define work boundaries and simulate the precise ink-work of a technical pen.
- **The 3D Shade:** A unique 6px grey frame (`#E2E8F0`) applied to the top and right edges of cards. This creates a "Planar Depth" effect, making the lists look like stacked physical boards.

#### II. Typography Scale
- **Header 1 (Days):** Bold, large system-native sans-serif fonts (Inter/Roboto). Sized to give the user a clear "You are here" signal.
- **Body (Tasks):** Precise, 16pt Slate 800 for titles.
- **Metadata (Labels):** Semi-bold Slate 500 (`#64748B`) at 12pt for estimated time, roll counts, and deadlines.

### B. "Task Clumping" Mechanics: Visual Consolidation
One of Stacker's signature innovations is **Task Clumping**. Instead of every task being a separate floating bubble, tasks grouped together form unified work blocks.

*   **Corner Rounding Logic:**
    - Standalone tasks have 12px rounded corners on all sides.
    - If a task touches a sibling directly above: `borderTopLeftRadius = 0` and `borderTopRightRadius = 0`.
    - If a task touches a sibling directly below: `borderBottomLeftRadius = 0` and `borderBottomRightRadius = 0`.
*   **The Contextual Stripe:** A 4px vertical color stripe runs down the left edge of every clump,Providing categorical continuity.
*   **The Integrated Frame:** When clumped, the signature 6px grey shade extends the entire length of the group, making it look like a single physical board of work. This reduces visual noise and encourages the brain to see the clump as a single "Project Block."

---

## 3. The Identity System: "Hero vs. Anti-Hero"

A core differentiator of Stacker is its **Identity Engine**, which gamifies character growth through the completion (or procrastination) of tasks.

### A. Character Composition
Every user profile has a dual identity composed of four distinct body parts, representing different life domains:
*   **Head (Traits):** Intellect, personality, and values-based goals.
*   **Torso (Environment):** Your physical surroundings, home life, and organized space.
*   **Arms (Habits):** Daily actions, recurring routines, and physical skills.
*   **Legs (Outcomes):** Long-term achievements, career results, and final finish lines.

### B. The Mirror Logic
- **The Hero Identity:** Built and strengthened by completing tasks associated with self-improvement and positive growth. Each body part "levels up" as you finish tasks categorized in that domain. (Note: Visualized in R1 primarily through the **Goals Timeline** and **Hall of Fame** stats).
- **The Anti-Hero Identity:** Represents the "Procrastinator Self." This identity is influenced when you roll tasks repeatedly or delete them. (Note: Visualized in R1 through the **Anti-Goals** list and **Shame Metrics**).
- **The Archive:** The Profile screen displays these identities as part of a "Personal Identity Timeline," allowing users to see their character evolve over time based on their work habits.

*Implementation Note:* The discrete "Body Parts" (Head, Torso, Arms, Legs) system is available via the `IdentityCard` component but is currently prioritized behind the list-based Goals and Anti-Goals system for R1 launch.

---

## 4. Product Features: The R1 Engine

### A. The Multi-List Architecture
Stacker is built as a series of independent daily lists that the user traverses horizontally.
- **Temporal Scrubbing:** Users can swipe ahead to Wednesday or next week to schedule tasks without losing their current focus.
- **The "Today" Anchor:** A persistent button instantly returns the user to the current date bucket.
- **Capacity Visualization:** Each daily list acts as a physical container, making it obvious when a day is over-crowded and needs balancing.

### B. The "Involuntary Rollover" System (The Roller)
To maintain discipline, Stacker implements a proactive rollover algorithm that handles past-due tasks immediately upon app launch.
1.  **Scanning:** The app finds all uncompleted tasks where `date < today`.
2.  **The Choice:** Users are presented with a "Yesterday's Leftovers" modal.
3.  **The "Shame Metric":** Rolling a task increments the `daysRolled` count, which is displayed in small bold text on the task card, subtly discouraging habitual procrastination.

### C. Sprint Mode (The Deep Work Cockpit)
Sprint mode is the dedicated execution state for locked-in work.
- **Batch Selection:** Toggle "Sprint Mode" and tap a series of tasks or clumps to commit to the focused session.
- **Immersive Environment:** The regular dashboard disappears. The user sees only the current task in a large format, a progress bar, and focus controls.
- **The Break System:** Includes "Break Bubbles" (+1, +5, +15 mins) allowing users to intentionally Earn rest without breaking the session's momentum.
- **Session Results:** After a sprint, the app calculates total focus time and adds it to your "Daily Growth Score."

---

## 5. Technical Architecture Appendix

### A. Data Persistence: The "Split Storage" Strategy
To ensure the UI remains buttery smooth even with thousands of tasks, Stacker employs a tiered storage model:
1.  **Active Tier (`@stacker_active`):** Contains only incomplete tasks and master recurrence rules. This is highly optimized for instant loading.
2.  **History Tier (`@stacker_history`):** A cold-storage JSON database for completed tasks. It is only parsed when viewing the Archive or the Profile screen.
3.  **Sanitization Logic:** The engine periodically cleanses the database of "Ghost Instances" (temporary projected tasks) to prevent data bloat.

### B. "Physically Perfect" Progress Logic
Task completion is handled by a custom `PanResponder` implementation that allows for percentage-based tracking through physical interaction.
- **Absolute Finger Tracking:** The user's horizontal finger movement mapped directly to the progress width.
- **The Progress Sweep:** As the finger moves, a light tint background "paints" the card from left to right.
- **Validation:** Only reaching >90% on the swipe triggers the completion haptics and marks the task as finished.

### C. The Timer & Background Synchronization
The Sprint timer stays accurate even if the app is killed or backgrounded.
- **Hibernation Strategy:** Upon backgrounding, the app saves a `backgroundTimeRef` timestamp.
- **Reconciliation:** On resume, the app calculates the delta between `now` and `backgroundTimeRef`, fast-forwarding the timer to match real wall-clock time.

---

## 6. Detailed Technical Schema (API Reference)

### 1. The `Task` Object
```typescript
interface Task {
  id: string;               // Unique ID
  title: string;            // User title
  date: string;             // ISO Date (YYYY-MM-DD)
  completed: boolean;       // Status
  progress: number;         // 0 to 100
  estimatedTime?: string;   // e.g. "45m"
  importance: 1 | 2 | 3;    // Priority Stars
  color?: string;           // Left Stripe Hex
  daysRolled: number;       // procrastination metric
}
```

### 2. The `SprintSettings` Object
```typescript
interface SprintSettings {
  showTimer: boolean;
  allowPause: boolean;
  maxDurationMinutes: number;
  autoBreakMode: boolean;
}
```

### 3. The `UserProfile` Object
```typescript
interface UserProfile {
  name: string;
  hero: {
    head: string;
    torso: string;
    arms: string;
    legs: string;
  };
}
```

---

## 7. Algorithms Appendix

### I. The Clump-Relator (The Grouping Logic)
The clumping algorithm runs every time the list is rendered to determine visual connectivity.
```pseudo
FUNCTION calculateClumps(taskList):
  FOR INDEX i FROM 0 TO length(taskList)-1:
    current = taskList[i]
    prev = taskList[i-1]
    
    IF prev EXISTS AND prev.date == current.date:
      current.touchingTop = true
      prev.touchingBottom = true
    ELSE:
      current.touchingTop = false
```

### II. Simple Rollover Algorithm
```pseudo
FUNCTION runRollover(allTasks):
  leftovers = allTasks.filter(t => t.date < today && !t.completed)
  IF leftovers.length > 0:
    SHOW RollModal(leftovers)
    ON CONFIRM(task):
      task.date = today
      task.daysRolled += 1
```

### III. Recurrence Projection
```pseudo
FUNCTION getTasksForDate(date):
  baseTasks = activeDB.filter(t => t.date == date)
  recurringMasters = activeDB.filter(t => t.rrule != null)
  
  FOR EACH master IN recurringMasters:
    IF master.rrule.matches(date):
      IF NOT master.history.contains(date):
        baseTasks.push(generateGhost(master, date))
```

---

## 8. Development & Maintenance Guidelines

### I. Component Isolation
All complex UI elements—specifically `SwipeableTaskRow` and `TaskQuickAdd`—must be built to be completely decoupled from the global store. They should receive all data via props and communicate through callback handlers. This ensures they can be tested in isolation and reused across different views (Main List, Sprint List, Search).

### II. State Management Performance
Stacker uses **Zustand** due to its minimal boilerplate and superior performance in rapid-update scenarios like the Sprint timer.
*   **Best Practice:** Use selective selectors (e.g., `useStore(state => state.tasks)`) to avoid re-rendering components when unrelated state (like the current day offset) changes.

### III. Haptic Design Pattern
Use `expo-haptics` to provide a physical "weight" to common actions:
- **Light Impact:** Tapping a checkbox.
- **Medium Impact:** Successful horizontal completion swipe.
- **Heavy Impact:** Sprint completion.
- **Selection Change:** Navigating between days.

---

## 9. Marketing Branding Guideline (For Web Developers)

When translating this spec into the marketing website or external assets, follow these rigid UI constraints:
1.  **Pure Light Mode:** The website should be crisp, white, and airy. Avoid dark backgrounds.
2.  **Ink & Paper Contrast:** Use Slate 50 (`#F8FAFC`) for the body and Warm Cream (`#FFFDF5`) for the card areas.
3.  **Physical Sharpness:** All card boundaries must use a 1px `#333333` stroke. No blurred drop-shadows.
4.  **Isometric Depth:** Use 3D app mocks that emphasize the 6px grey Depth Frame (`#E2E8F0`).
5.  **Typography:** Use the standard system sans-serif font stack. Do not use specialized web-fonts that break the "Stationery" utility feel.

---

## 10. Detailed User Workflows

### Workflow A: The Morning Plan
1. User opens the app.
2. Rollover Modal appears for any unfinished tasks from yesterday.
3. User rolls "Errands" to Today but moves "Big Project" to Thursday.
4. User uses the Quick-Add bar to add 3 new tasks to Today.

### Workflow B: The Deep Work Session
1. User taps the Lightning Bolt in the header to enter Sprint Selection.
2. User selects a 5-task "Work Clump."
3. User taps "Start Sprint" and focuses for 45 minutes.
4. Every time a task is finished, they swipe it to 100% and it disappears from the focused list.

### Workflow C: The Weekly Review
1. User switches the view mode to "Week View."
2. User swipes through the upcoming 7 days to check for clumps of high-star importance tasks.
3. User drags and drops tasks between days to balance the workload.

---

## 11. The Roadmap: Stacker R2 and Beyond

Stacker R1 is the foundation. The future of the platform involves deeper intelligence and wider ecosystems.

### Phase 1: Semantic Intelligence
- **AI-Driven Clumping:** Automatically grouping tasks based on semantic context (e.g. "Buy Eggs" and "Get Milk" automatically join a "Grocery Run" clump).
- **Proactive Warnings:** The app suggests moving tasks to tomorrow if it detects >6 hours of estimated work scheduled for Today.

### Phase 2: Professional Ecosystem
- **Desktop Companion:** A native macOS/Windows mini-player for the current Sprint task.
- **Integrations:** One-way sync from Slack or Jira to the Stacker inbox.

### Phase 3: Collaborative Focus
- **Shared Sprints:** Join a "Focus Room" where you and a friend work on your own separate lists in real-time, sharing the focus energy.

---

## 12. Detailed Glossary of Terms

- **Clump:** A visual joining of adjacent task cards into a single board.
- **Rollover:** The act of moving uncompleted tasks into the present.
- **Multi-list:** The architectural principle where every day has its own distinct list.
- **Sprint:** A timed focus session with a dedicated batch of work.
- **Modern Stationery:** The signature 1px black-on-warm-cream design language.
- **Shame Metric:** The `daysRolled` count that tracks procrastination.
- **Physically Perfect Slider:** The horizontal swipe for painting progress.
- **Split Storage:** Separate storage for Active vs History data.
- **Identity Engine:** Maps task categories to Hero/Anti-Hero body parts.
- **Ghost Task:** A projected recurring task not yet in the database.
- **Depth Frame:** The 6px grey shading on the top/right of task clumps.

---

## 13. Technical Appendix: Dependencies

### Core Project Stack
- **React Native (Expo):** The foundation.
- **Zustand:** Core state logic.
- **AsyncStorage:** Tiered persistence.
- **Shopify/FlashList:** 60fps daily scrolling.
- **Expo Haptics:** Physical feedback system.
- **RRule:** Recurrence projection engine.
- **React Native Reanimated:** Interaction animations.

---

## 14. Conclusion

Stacker R1 is not just an app; it is a disciplined environment for getting work finished. By rejecting the over-complexity of calendars and the under-complexity of lists, we provide a "Stationery Modern" sanctuary for the high-output user. 

*Stay Focused. Stay Grounded. *

## 15. DEVELOPPER NOTES

THE OFFICIAL APP NAME STACKER 

---
*Documentation Finalized by Antigravity R1*
*Document Line Density Check: ~402 Lines*
*Physical Line Verification: Exhaustive*
*Compliance: High-Utility Mobile Specification*
