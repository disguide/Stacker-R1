# Stacker R1 Development Roadmap

This document outlines the planned features and improvements for Stacker R1, along with a proposed implementation order.

## Feature List

### 1. Aesthetics & Typography
*   **Goal**: Simplify the visual design.
*   **Actions**:
    *   Change the font.
    *   Update aesthetics to be more simplistic (minimalist).

### 2. "8D" Date Display
*   **Goal**: Show the number of days remaining/offset from the present day alongside the date.
*   **Example**: "4D" indicates 4 days from today.

### 3. Reminder Function
*   **Goal**: Add a reminder capability accessible via the "3 dots" menu.
*   **Design**:
    *   Figure out how to fit a "tag" for the reminder in the UI.
    *   Implement the scheduling logic.

### 4. Edit & Task Adding Improvements
*   **Goal**: Refine the core interaction for creating and editing tasks.
*   **Actions**:
    *   Clean up the aesthetics of the edit/add interface.
    *   Add a **Swipe Feature**: Turn the value selection (or the view itself) into a carousel-like experience.

### 5. Filter System
*   **Goal**: Organize tasks better.
*   **Actions**:
    *   Implement a system to filter tasks (e.g., by status, tag, priority).
    *   Better organization of the task list.

### 6. Telescope (Long-term Planning)
*   **Goal**: A new view or feature for long-term planning.
*   **Actions**:
    *   Design and build the "telescope" interface.
    *   Allow users to look further ahead than the standard view.

### 7. Profile: Goals & Anti-Goals
*   **Goal**: a dedicated section for high-level objectives.
*   **Actions**:
    *   Add a feature to profile/list "Goals".
    *   Add a feature to profile/list "Anti-Goals" (things to avoid).

### 8. Sprint Feature
*   **Goal**: Improve the existing Sprint mode.
*   **Actions**:
    *   Redesign and enhance the Sprint feature.

---

## Proposed Implementation Order

I recommend the following order to maximize efficiency and maintain a stable codebase:

1.  **Aesthetics & Typography**
    *   **Reason**: Changing fonts and core aesthetics is a global change. Doing this first establishes the "visual language" for all subsequent features, preventing the need to re-style new components later.

2.  **Edit & Task Adding Improvements (Swipe/Carousel)**
    *   **Reason**: Creating and editing tasks is the core loop of the application. Improving this early ensures the most used part of the app feels great immediately. The "Carousel" interaction is a significant UI change that might affect how we display data.

3.  **Filter System**
    *   **Reason**: As features like "Goals" and "Telescope" are added, the number of items might grow. A robust filter system provides the architectural foundation to manage these views effectively.

4.  **"8D" Date Display**
    *   **Reason**: This is a contained, high-value visual utility. It can be implemented quickly on top of the existing date logic (which we reviewed in `src/utils/dateHelpers.ts`).

5.  **Reminder Function**
    *   **Reason**: This adds logic complexity (scheduling, permissions). It's better to add this once the visual container (the task card/3 dots menu) is stable.

6.  **Sprint Feature**
    *   **Reason**: Since this is an improvement to an *existing* feature (`app/sprint.tsx`), we can tackle it once the main task list (the primary view) is polished.

7.  **Telescope (Long-term Planning)**
    *   **Reason**: This is likely a new, complex view. It will benefit from the styling and filtering patterns established in steps 1-3.

8.  **Profile: Goals & Anti-Goals**
    *   **Reason**: This seems to be a separate module or screen, somewhat independent of the daily task flow. It can be built in parallel or at the end without blocking other core features.
