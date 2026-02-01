# Feature Specifications: Recurrence, Subtasks & Deletion

> Detailed rules and behaviors for complex features in Stacker R1

---

## 📅 Recurrence System

### Overview

Recurring tasks use a **Master-Ghost** pattern:
- **Master Task**: The actual task stored in the database
- **Ghost Instance**: A virtual projection of the master for a specific date
- **RRule**: Industry-standard recurrence rule format (RFC 5545)

```
┌─────────────────────────────────────────────────────────┐
│                     MASTER TASK                         │
│  id: "abc123"                                          │
│  title: "Morning Standup"                              │
│  date: "2026-01-01"  (start date)                      │
│  rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR"                   │
│  completedDates: ["2026-01-13", "2026-01-15"]          │
│  exceptionDates: ["2026-01-17"]                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   GHOST INSTANCES                       │
│  "abc123_2026-01-13" ──► Monday   (completed ✓)        │
│  "abc123_2026-01-15" ──► Wednesday (completed ✓)       │
│  "abc123_2026-01-17" ──► Friday   (skipped/deleted)    │
│  "abc123_2026-01-20" ──► Monday   (upcoming)           │
│  "abc123_2026-01-22" ──► Wednesday (upcoming)          │
└─────────────────────────────────────────────────────────┘
```

---

### Recurrence Rules (REC-1 to REC-12)

#### REC-1: Ghost ID Format
Ghost IDs follow the pattern: `{masterId}_{YYYY-MM-DD}`

```typescript
// Creating a ghost ID
const ghostId = `${masterId}_${dateString}`;
// Example: "abc123_2026-01-30"

// Parsing a ghost ID
function parseGhostId(id: string) {
  if (id.includes('_')) {
    const parts = id.split('_');
    const potentialDate = parts[parts.length - 1];
    if (potentialDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return {
        masterId: parts.slice(0, -1).join('_'),
        dateString: potentialDate,
        isGhost: true
      };
    }
  }
  return { masterId: id, dateString: null, isGhost: false };
}
```

#### REC-2: Completion Tracking
Recurring task completion is tracked per-date in `completedDates` array.

```typescript
interface Task {
  completedDates: string[];  // ["2026-01-28", "2026-01-29"]
}

// Check if completed on a specific date
const isCompletedOnDate = task.completedDates.includes(dateString);
```

#### REC-3: Toggling Completion
When toggling a recurring task:
- **Completing**: Add date to `completedDates`
- **Uncompleting**: Remove date from `completedDates`

```typescript
function toggleRecurringTask(masterId: string, dateString: string) {
  const task = findTask(masterId);
  
  if (task.completedDates.includes(dateString)) {
    // Uncomplete: remove from array
    task.completedDates = task.completedDates.filter(d => d !== dateString);
  } else {
    // Complete: add to array
    task.completedDates = [...task.completedDates, dateString];
  }
}
```

#### REC-4: Exception Dates
Use `exceptionDates` to skip specific occurrences without deleting the series.

```typescript
interface Task {
  exceptionDates: string[];  // Dates to skip
}

// When projecting occurrences, filter out exceptions
const occurrences = rrule.between(start, end).filter(
  date => !task.exceptionDates.includes(toISODateString(date))
);
```

#### REC-5: Editing a Single Instance
When editing ONE instance of a recurring task:
1. Add the date to `exceptionDates` (hide original)
2. Create a NEW standalone task for that date with modifications

```typescript
function editSingleInstance(masterId: string, dateString: string, updates: Partial<Task>) {
  const masterTask = findTask(masterId);
  
  // Hide this occurrence from the series
  masterTask.exceptionDates.push(dateString);
  
  // Create a new standalone task with the edits
  const newTask: Task = {
    id: generateId(),
    title: updates.title ?? masterTask.title,
    date: dateString,
    // ... copy other fields with updates
    rrule: undefined  // NOT recurring - standalone
  };
  
  addTask(newTask);
}
```

#### REC-6: Editing the Entire Series
When editing ALL future instances:
- Update the master task directly
- Changes apply to all future ghost instances

```typescript
function editSeries(masterId: string, updates: Partial<Task>) {
  updateTask(masterId, updates);
  // All ghost projections will automatically reflect changes
}
```

#### REC-7: Supported Frequencies
The app supports these recurrence patterns:

| Frequency | RRule | Example |
|-----------|-------|---------|
| Daily | `FREQ=DAILY` | Every day |
| Weekly | `FREQ=WEEKLY` | Every week on same day |
| Weekly (custom) | `FREQ=WEEKLY;BYDAY=MO,WE,FR` | Mon, Wed, Fri |
| Monthly | `FREQ=MONTHLY` | Same date each month |
| Yearly | `FREQ=YEARLY` | Same date each year |

#### REC-8: Interval Support
Support for intervals (every 2 weeks, every 3 days, etc.):

```typescript
// Every 2 weeks
rrule: "FREQ=WEEKLY;INTERVAL=2"

// Every 3 days
rrule: "FREQ=DAILY;INTERVAL=3"
```

#### REC-9: End Conditions
Recurrence can end by:
- **Count**: After N occurrences
- **Until**: On a specific date
- **Never**: Continues indefinitely

```typescript
// After 10 occurrences
rrule: "FREQ=DAILY;COUNT=10"

// Until March 1, 2026
rrule: "FREQ=DAILY;UNTIL=20260301T000000Z"
```

#### REC-10: Projection Window
Only project occurrences within the visible date range to optimize performance.

```typescript
function generateCalendarItems(tasks: Task[], startDate: string, days: number) {
  const endDate = addDays(startDate, days);
  
  tasks.forEach(task => {
    if (task.rrule) {
      const rule = RRule.fromString(task.rrule);
      const occurrences = rule.between(
        new Date(startDate),
        new Date(endDate)
      );
      // Create ghost for each occurrence
    }
  });
}
```

#### REC-11: Subtasks on Recurring Tasks
Subtasks belong to the MASTER task, not individual ghosts. All occurrences share the same subtasks.

```typescript
// Subtask completion is global across all instances
// (Current limitation - future enhancement could track per-date)
```

#### REC-12: Display Priority
When displaying tasks, show in this order:
1. Overdue tasks (past dates, incomplete)
2. Today's tasks
3. Future tasks
4. Within each date: by creation time or priority

---

## 📋 Subtask System

### Overview

Subtasks are nested items within a parent task.

```
┌─────────────────────────────────────────────────────────┐
│  PARENT TASK: "Prepare Presentation"                    │
│  ├── SUBTASK: "Create outline"           ✓ completed   │
│  ├── SUBTASK: "Design slides"            ○ in progress │
│  └── SUBTASK: "Practice delivery"        ○ pending     │
└─────────────────────────────────────────────────────────┘
```

---

### Subtask Rules (SUB-1 to SUB-10)

#### SUB-1: Data Structure
Subtasks are stored as an array on the parent task.

```typescript
interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  deadline?: string;
  estimatedTime?: string;
  progress?: number;
}

interface Task {
  subtasks?: Subtask[];
}
```

#### SUB-2: Subtask IDs
Subtask IDs are unique within the app (not just within parent).

```typescript
// Generate subtask ID
const subtaskId = Date.now().toString();
```

#### SUB-3: Adding Subtasks
Subtasks are added to the parent's subtasks array.

```typescript
function addSubtask(parentId: string, subtask: Subtask) {
  const parent = findTask(parentId);
  parent.subtasks = [...(parent.subtasks || []), subtask];
  updateTask(parentId, { subtasks: parent.subtasks });
}
```

#### SUB-4: Subtasks on Recurring Tasks
For recurring tasks, subtasks belong to the MASTER. All ghosts show the same subtasks.

```typescript
// When adding subtask to ghost, resolve to master first
function addSubtaskToGhost(ghostId: string, subtask: Subtask) {
  const { masterId } = parseGhostId(ghostId);
  addSubtask(masterId, subtask);
}
```

#### SUB-5: Completion Independence
Subtask completion is independent of parent completion.
- Parent can be incomplete while subtasks are complete
- Completing parent does NOT auto-complete subtasks
- Completing all subtasks does NOT auto-complete parent

#### SUB-6: Progress Calculation (Future Enhancement)
Parent progress could be calculated from subtasks:

```typescript
function calculateParentProgress(task: Task): number {
  if (!task.subtasks?.length) return task.progress ?? 0;
  
  const completedCount = task.subtasks.filter(s => s.completed).length;
  return Math.round((completedCount / task.subtasks.length) * 100);
}
```

#### SUB-7: Estimated Time Aggregation
Parent's displayed time includes subtask times.

```typescript
function getTotalEstimatedTime(task: Task): number {
  let total = parseEstimatedTime(task.estimatedTime);
  
  task.subtasks?.forEach(sub => {
    if (!sub.completed) {
      total += parseEstimatedTime(sub.estimatedTime);
    }
  });
  
  return total;
}
```

#### SUB-8: Subtask Display Order
Display subtasks in creation order (array order).

#### SUB-9: Maximum Subtask Depth
Subtasks can only be ONE level deep. No nested subtasks.

```
✅ Task → Subtask
❌ Task → Subtask → Sub-subtask
```

#### SUB-10: Subtask Limits
Consider a soft limit of ~20 subtasks per task for performance. Show warning if exceeded.

---

## 🗑️ Deletion System

### Overview

Deletion behavior varies based on task type:

| Task Type | Options |
|-----------|---------|
| Single Task | Delete immediately |
| Recurring (single instance) | Add to exceptionDates |
| Recurring (future) | Delete master + future |
| Recurring (all) | Delete master completely |

---

### Deletion Rules (DEL-1 to DEL-12)

#### DEL-1: Single Task Deletion
Delete the task from storage immediately.

```typescript
function deleteSingleTask(taskId: string) {
  tasks = tasks.filter(t => t.id !== taskId);
  saveTasks(tasks);
}
```

#### DEL-2: Recurring Task - Prompt Required
When deleting a recurring task, ALWAYS show options:

```
╔═══════════════════════════════════════════╗
║     Delete Repeating Task                 ║
╠═══════════════════════════════════════════╣
║  Do you want to delete just this         ║
║  instance or all future tasks?           ║
║                                           ║
║  [Cancel]  [This One]  [All Future]      ║
╚═══════════════════════════════════════════╝
```

#### DEL-3: Delete Single Instance (This One)
Add the date to `exceptionDates` array.

```typescript
function deleteSingleInstance(masterId: string, dateString: string) {
  const task = findTask(masterId);
  task.exceptionDates = [...task.exceptionDates, dateString];
  updateTask(masterId, { exceptionDates: task.exceptionDates });
}
```

#### DEL-4: Delete Future Instances
Modify the rrule to end at the selected date, or delete master if it's the first instance.

```typescript
function deleteFutureInstances(masterId: string, fromDate: string) {
  const task = findTask(masterId);
  
  if (task.date === fromDate) {
    // Deleting from start = delete entire task
    deleteSingleTask(masterId);
  } else {
    // Set UNTIL to day before deletion date
    const untilDate = addDays(fromDate, -1);
    const rule = RRule.fromString(task.rrule);
    rule.options.until = new Date(untilDate);
    updateTask(masterId, { rrule: rule.toString() });
  }
}
```

#### DEL-5: Delete All Instances
Delete the master task entirely.

```typescript
function deleteAllInstances(masterId: string) {
  deleteSingleTask(masterId);
}
```

#### DEL-6: Subtask Deletion
Remove subtask from parent's array.

```typescript
function deleteSubtask(parentId: string, subtaskId: string) {
  const { masterId } = parseGhostId(parentId);
  const parent = findTask(masterId);
  
  parent.subtasks = parent.subtasks.filter(s => s.id !== subtaskId);
  updateTask(masterId, { subtasks: parent.subtasks });
}
```

#### DEL-7: Cascade on Parent Deletion
When a parent task is deleted, all its subtasks are automatically deleted (they're part of the task object).

#### DEL-8: History / Soft Delete
Completed tasks go to history for potential restoration.

```typescript
interface HistoryEntry {
  task: Task;
  completedAt: string;  // ISO timestamp
}

async function moveToHistory(task: Task) {
  const history = await loadHistory();
  history.push({
    task,
    completedAt: new Date().toISOString()
  });
  await saveHistory(history);
  await deleteTask(task.id);
}
```

#### DEL-9: History Limits
Keep history for 30 days or last 100 tasks (whichever is reached first).

```typescript
function pruneHistory(history: HistoryEntry[]): HistoryEntry[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return history
    .filter(h => new Date(h.completedAt) > thirtyDaysAgo)
    .slice(-100);
}
```

#### DEL-10: Restore from History
Restore a task from history back to active tasks.

```typescript
async function restoreFromHistory(taskId: string) {
  const history = await loadHistory();
  const entry = history.find(h => h.task.id === taskId);
  
  if (entry) {
    // Add back to tasks
    await addTask({
      ...entry.task,
      completed: false,
      completedDates: []
    });
    
    // Remove from history
    const updatedHistory = history.filter(h => h.task.id !== taskId);
    await saveHistory(updatedHistory);
  }
}
```

#### DEL-11: Permanent Delete from History
Allow permanent deletion from history.

```typescript
async function permanentDelete(taskId: string) {
  const history = await loadHistory();
  const updatedHistory = history.filter(h => h.task.id !== taskId);
  await saveHistory(updatedHistory);
}
```

#### DEL-12: Undo Support
For immediate deletions, provide 5-second undo toast.

```typescript
function showUndoToast(task: Task) {
  showToast({
    message: "Task deleted",
    action: {
      label: "Undo",
      onPress: () => addTask(task)
    },
    duration: 5000
  });
}
```

---

## 🔄 State Transitions

### Task Lifecycle

```
                    ┌──────────────┐
                    │   CREATED    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  EDITED  │ │ IN SPRINT│ │COMPLETING│
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          ▼
                   ┌──────────────┐
                   │  COMPLETED   │
                   └──────┬───────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
       ┌──────────────┐        ┌──────────────┐
       │   HISTORY    │        │   DELETED    │
       └──────┬───────┘        └──────────────┘
              │
              ▼
       ┌──────────────┐
       │   RESTORED   │ ──► Back to CREATED
       └──────────────┘
```

### Recurring Task Completion Flow

```
Ghost Instance Tapped
        │
        ▼
   ┌────────────┐
   │ Is Already │──Yes──► Remove from completedDates
   │ Completed? │               │
   └─────┬──────┘               ▼
         │                Show as incomplete
        No
         │
         ▼
   Add to completedDates
         │
         ▼
   Show as complete
   (with 2s undo window)
```

---

## 📋 Decision Matrix

### When user taps "Edit" on recurring task:

| Scenario | Prompt | Action |
|----------|--------|--------|
| Edit title only | "Edit this one or all?" | User chooses |
| Edit deadline | "Edit this one or all?" | User chooses |
| Edit recurrence pattern | Auto: Edit all | Changes affect whole series |
| Edit subtasks | Auto: Edit all | Subtasks are shared |

### When user taps "Delete" on recurring task:

| Scenario | Prompt | Action |
|----------|--------|--------|
| First instance | "Delete all?" | Just delete master |
| Middle instance | Show 3 options | Cancel / This one / All future |
| Last instance | Show 2 options | Cancel / This one |

### When user completes recurring task:

| Scenario | Action |
|----------|--------|
| Tap checkbox | Mark date complete (2s undo) |
| Tap again within 2s | Cancel completion |
| Swipe complete | Mark date complete immediately |

---

## 🔧 Implementation Checklist

- [ ] Ghost ID parsing works correctly
- [ ] Completing recurring task adds to `completedDates`
- [ ] Uncompleting removes from `completedDates`  
- [ ] Single instance deletion adds to `exceptionDates`
- [ ] Series deletion prompts user
- [ ] Future deletion modifies rrule UNTIL
- [ ] Subtasks attach to master (not ghosts)
- [ ] Subtask deletion works on ghost IDs
- [ ] History stores completed tasks
- [ ] Restore from history works
- [ ] Undo toast shows for 5 seconds

---

## 🔗 Cross-Feature Interactions

This section explains how **Recurrence**, **Subtasks**, and **Deletion** interact with each other.

---

### Subtasks + Recurrence

#### Current Behavior: Subtasks are SHARED across all instances

When you add a subtask to a recurring task, it appears on EVERY ghost instance because subtasks belong to the **Master Task**, not individual ghosts.

```
MASTER TASK: "Weekly Review" (repeats every Monday)
├── subtasks: ["Prepare notes", "Update docs"]

MONDAY JAN 27 (Ghost)
├── Shows: "Prepare notes", "Update docs"

MONDAY FEB 3 (Ghost)
├── Shows: "Prepare notes", "Update docs"  ◄── SAME subtasks!

MONDAY FEB 10 (Ghost)
├── Shows: "Prepare notes", "Update docs"  ◄── SAME subtasks!
```

#### Why This Happens
```typescript
// When rendering a ghost instance:
const ghost = {
  id: `${masterId}_${dateString}`,
  title: masterTask.title,
  subtasks: masterTask.subtasks,  // ◄── REFERENCE to master's subtasks
  // ...
};
```

#### Interaction Matrix: Subtasks on Recurring Tasks

| Action | What Happens | Affects |
|--------|--------------|---------|
| **Add subtask to any instance** | Added to master's subtask array | ALL instances show it |
| **Complete subtask on any instance** | Master's subtask marked complete | ALL instances show complete |
| **Delete subtask on any instance** | Removed from master's array | ALL instances lose it |
| **Edit subtask on any instance** | Master's subtask updated | ALL instances show change |

#### Future Enhancement: Per-Instance Subtasks

To support per-instance subtask completion (e.g., "Prepare notes" complete on Jan 27 but not Feb 3):

```typescript
interface Task {
  subtasks: Subtask[];
  
  // NEW: Track subtask completion per date
  subtaskCompletions: {
    [dateString: string]: {
      [subtaskId: string]: boolean;
    };
  };
}

// Example:
subtaskCompletions: {
  "2026-01-27": { "subtask1": true, "subtask2": false },
  "2026-02-03": { "subtask1": false, "subtask2": false }
}
```

---

### Deletion + Recurrence

#### Deleting a Recurring Task Instance

| Delete Target | Prompt Shown | Result |
|---------------|--------------|--------|
| Single ghost | "This one or all?" | Adds date to `exceptionDates` |
| All future | "This one or all?" | Modifies rrule with UNTIL |
| Entire series | "This one or all?" | Deletes master task |

```
BEFORE DELETE (exceptionDates: [])
├── Jan 27 ✓ Shows
├── Feb 3  ✓ Shows
├── Feb 10 ✓ Shows

USER DELETES "Feb 3" (this one only)

AFTER DELETE (exceptionDates: ["2026-02-03"])
├── Jan 27 ✓ Shows
├── Feb 3  ✗ HIDDEN (in exceptionDates)
├── Feb 10 ✓ Shows
```

#### Deleting Task with Subtasks

When you delete a task (recurring or single), ALL its subtasks are automatically deleted because they're nested in the task object.

```
DELETE "Weekly Review"
├── subtasks: ["Prepare notes", "Update docs"]
    ▲
    └── ALSO DELETED (cascade)
```

---

### Deletion + Subtasks

#### Deleting a Subtask

| Parent Type | Action | Result |
|-------------|--------|--------|
| Single task | Delete subtask | Removed from parent |
| Recurring task | Delete subtask on any ghost | Removed from master → ALL ghosts lose it |

```typescript
// Deleting subtask from ghost resolves to master first
function deleteSubtask(parentId: string, subtaskId: string) {
  const { masterId } = parseGhostId(parentId);  // ◄── Resolve to master
  
  const master = findTask(masterId);
  master.subtasks = master.subtasks.filter(s => s.id !== subtaskId);
  updateTask(masterId, { subtasks: master.subtasks });
}
```

---

### Completion + Recurrence + Subtasks

#### Completing a Recurring Task

| Action | What Gets Saved | Subtask Effect |
|--------|-----------------|----------------|
| Complete task on Jan 27 | `completedDates: ["2026-01-27"]` | Subtasks unchanged |
| Complete task on Feb 3 | `completedDates: ["2026-01-27", "2026-02-03"]` | Subtasks unchanged |

**Key Point**: Completing a recurring task instance does NOT auto-complete its subtasks. They are independent.

#### Completing a Subtask on Recurring Task

| Action | What Gets Saved | All Instances |
|--------|-----------------|---------------|
| Complete subtask | `subtasks[n].completed = true` | ALL show subtask as complete |

```
CURRENT BEHAVIOR:
├── Mon Jan 27: Subtask "Prepare notes" ✓ COMPLETE
├── Mon Feb 3:  Subtask "Prepare notes" ✓ COMPLETE  ◄── Also shows complete!
├── Mon Feb 10: Subtask "Prepare notes" ✓ COMPLETE  ◄── Also shows complete!
```

---

### Editing + Recurrence + Subtasks

#### Editing a Recurring Task

| What You Edit | Options | Subtask Effect |
|---------------|---------|----------------|
| Title | "This one or all?" | None |
| Deadline | "This one or all?" | None |
| Estimated time | "This one or all?" | None |
| Recurrence pattern | Auto: all | None |
| Add subtask | Auto: all | Appears on ALL instances |
| Edit subtask | Auto: all | Change on ALL instances |
| Delete subtask | Auto: all | Gone from ALL instances |

#### "This One" vs "All Future" for Edits

**"This One" (Detach)**:
1. Add date to master's `exceptionDates`
2. Create NEW standalone task with edits
3. Subtasks are COPIED to new standalone task

```
BEFORE "Edit This One" on Feb 3:
MASTER: "Weekly Review" repeats Mon
├── exceptionDates: []
├── subtasks: ["Prepare notes"]

AFTER editing title to "Special Review" on Feb 3:
MASTER: "Weekly Review" repeats Mon
├── exceptionDates: ["2026-02-03"]  ◄── Feb 3 now hidden
├── subtasks: ["Prepare notes"]

NEW TASK: "Special Review" (standalone, Feb 3 only)
├── rrule: null  ◄── NOT recurring
├── subtasks: ["Prepare notes"]  ◄── COPIED from master
```

**"All Future"**:
1. Update master task directly
2. All future ghosts reflect change
3. Subtasks remain on master

---

### Full Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MASTER TASK                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  id: "abc123"                                                     │  │
│  │  title: "Weekly Review"                                           │  │
│  │  rrule: "FREQ=WEEKLY;BYDAY=MO"                                    │  │
│  │  completedDates: ["2026-01-27"]                                   │  │
│  │  exceptionDates: ["2026-02-17"]                                   │  │
│  │  subtasks: [                                                      │  │
│  │    { id: "s1", title: "Prepare notes", completed: true },         │  │
│  │    { id: "s2", title: "Update docs", completed: false }           │  │
│  │  ]                                                                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  GHOST: Jan 27   │    │  GHOST: Feb 3    │    │  GHOST: Feb 10   │
│  ──────────────  │    │  ──────────────  │    │  ──────────────  │
│  id: abc123_     │    │  id: abc123_     │    │  id: abc123_     │
│      2026-01-27  │    │      2026-02-03  │    │      2026-02-10  │
│                  │    │                  │    │                  │
│  ✓ COMPLETED     │    │  ○ NOT COMPLETE  │    │  ○ NOT COMPLETE  │
│  (in completed   │    │                  │    │                  │
│   Dates)         │    │                  │    │                  │
│                  │    │                  │    │                  │
│  Subtasks:       │    │  Subtasks:       │    │  Subtasks:       │
│  ✓ Prepare notes │    │  ✓ Prepare notes │    │  ✓ Prepare notes │
│  ○ Update docs   │    │  ○ Update docs   │    │  ○ Update docs   │
│  ▲               │    │  ▲               │    │  ▲               │
│  └── FROM MASTER │    │  └── FROM MASTER │    │  └── FROM MASTER │
└──────────────────┘    └──────────────────┘    └──────────────────┘

┌──────────────────┐
│  Feb 17: HIDDEN  │ ◄── In exceptionDates (deleted "this one")
└──────────────────┘
```

---

### Summary Table: Feature Interactions

| Scenario | Recurrence | Subtasks | Deletion |
|----------|------------|----------|----------|
| Add subtask to recurring | Applies to master | Shows on ALL ghosts | N/A |
| Complete subtask on ghost | N/A | ALL ghosts show complete | N/A |
| Delete subtask on ghost | N/A | ALL ghosts lose subtask | Uses master ID |
| Delete single ghost | Adds to exceptionDates | Subtasks preserved on master | Hides that date only |
| Delete all future | Modifies rrule UNTIL | Subtasks preserved until end | Future dates hidden |
| Delete entire series | Deletes master | ALL subtasks deleted | Complete removal |
| Complete ghost | Adds to completedDates | Subtasks unchanged | N/A |
| Complete task with subtasks | Task marked done | Subtasks NOT auto-completed | N/A |
| Delete task with subtasks | N/A | Subtasks cascade deleted | Single removal |

---

### Design Decisions to Consider

1. **Should subtask completion be per-instance for recurring tasks?**
   - Current: NO - subtasks are shared
   - Future option: YES - track in `subtaskCompletions` map

2. **Should completing all subtasks auto-complete the parent?**
   - Current: NO - independent
   - Option: YES - with user preference setting

3. **Should deleting a subtask from one ghost only affect that instance?**
   - Current: NO - affects all instances
   - This would require per-instance subtask arrays

4. **Should there be an "Undo" for subtask operations on recurring tasks?**
   - Consider: Changes affect all instances, so undo is valuable
