# Stacker R1 Development Roadmap

This document outlines the planned features and improvements for Stacker R1, along with a proposed implementation order.

## Feature List

### 1. Aesthetics & Typography (COMPLETED ✅)
*   **Goal**: Simplify the visual design and unify styling.
*   **Actions**:
    *   Standardized "Modern Stationery" design system (Slate 50 / Warm Cream / Ink Black).
    *   Implemented premium dark gradients for hero elements.
    *   Unified card dimensions and aspect ratios across all screens.

### 2. "8D" Date Display (PLANNED ⏳)
*   **Goal**: Show the number of days remaining/offset from the present day alongside the date.
*   **Example**: "4D" indicates 4 days from today.

### 3. Reminder Function (PLANNED ⏳)
*   **Goal**: Add a reminder capability accessible via the "3 dots" menu.
*   **Design**:
    *   Figure out how to fit a "tag" for the reminder in the UI.
    *   Implement the scheduling logic.

### 4. Edit & Task Adding Improvements (PLANNED ⏳)
*   **Goal**: Refine the core interaction for creating and editing tasks.
*   **Actions**:
    *   Clean up the aesthetics of the edit/add interface.
    *   Add a **Swipe Feature**: Turn the value selection (or the view itself) into a carousel-like experience.

### 5. Filter System (PLANNED ⏳)
*   **Goal**: Organize tasks better.
*   **Actions**:
    *   Implement a system to filter tasks (e.g., by status, tag, priority).
    *   Better organization of the task list.

### 6. Telescope (Long-term Planning) (PLANNED ⏳)
*   **Goal**: A new view or feature for long-term planning.
*   **Actions**:
    *   Design and build the "telescope" interface.
    *   Allow users to look further ahead than the standard view.

### 7. Profile: Goals & Anti-Goals (COMPLETED ✅)
*   **Goal**: A dedicated section for high-level objectives.
*   **Actions**:
    *   Implemented visual "Goals Timeline" with dynamic coloring.
    *   Added "Anti-Goals" list and "Hall of Fame" analytics.
    *   Standardized hero card layout for all profile modules.

### 8. Sprint Feature (COMPLETED ✅)
*   **Goal**: Improve the existing Sprint mode.
*   **Actions**:
    *   Refined the Sprint History and Summary views.
    *   Standardized time unit localization (hours/minutes/seconds) across all locales.
    *   Improved sprint results visualization.

---

## Current Status & Next Steps

We have completed the core visual identity and the primary profile/analytics modules. The next focus areas are:

1.  **Core Task Interaction**: Implementing the "Swipe Feature" and cleaning up the task edit/add interface.
2.  **Organization Utilities**: Building the Filter System to handle growing task lists.
    *   **"8D" Date Display**: Adding this quick visual utility to the daily views.
3.  **Advanced Logic**: Integrating Reminders and scheduling.
4.  **Long-Term Strategy**: Building the "Telescope" view.

---

## Completed Milestones

1.  **Phase 1: Aesthetics & Typography** (Establish the visual language)
2.  **Phase 7: Profile: Goals & Anti-Goals** (High-level objectives tracking)
3.  **Phase 8: Sprint Feature** (Deep work cockpit refinements)
