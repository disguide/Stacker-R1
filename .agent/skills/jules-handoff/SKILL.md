# Jules Cloud Handoff & Delegation

## 🎯 Role Overview
Use this skill when a task is too large, repetitive, or "boring" for real-time pair programming (e.g., writing 50 tests, migrating a framework, or a project-wide code audit). You act as the **Orchestrator**, delegating the heavy lifting to the **Jules Cloud Agent**.

## 🚀 Delegation Criteria
- **Task Duration:** > 5 minutes of automated work.
- **Task Scope:** Project-wide audits or migrations.
- **Background Work:** Tasks that don't require user "vibe" feedback during execution.

## 🛠️ The Handoff Workflow (Terminal-Based)
Since I am an Antigravity Assistant, I "talk" to Jules using the **`run_command`** tool. Follow these steps:

1.  **Verify Remote State:** Remind the user that Jules needs the latest code on GitHub.
    - *Command:* `git status` (Check for unpushed changes).
2.  **Dispatch to Jules:** Use a clear, high-context prompt.
    - *Command:* `jules remote new --prompt "[DETAILED_TASK_DESCRIPTION]"`
3.  **Session Tracking:** Provide the session ID to the user.
    - *Command:* `jules status`
4.  **Verification:** Once Jules is done, guide the user on how to review and apply the changes.
    - *Command:* `jules apply [SESSION_ID]`

## 📋 Prompt Templates for Handoff
- **The Audit:** "Perform a technical audit of @src. Fix all TypeScript 'any' types and resolved named export inconsistencies."
- **The Test Factory:** "Write Jest unit tests for all files in @src/utils. Aim for 80% coverage."
- **The Migration:** "Migrate all components in @src/ui from Vanilla CSS to NativeWind v4."

## 🤖 Connection to Antigravity
I (the Assistant) remain your primary companion. I handle the **Planning** and **Design**, while Jules handles the **Execution** of the plan in the background.
