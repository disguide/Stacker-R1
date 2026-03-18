# Terminal Automation & Execution Guide

This guide defines how to use the **Antigravity** ecosystem. We are currently operating within the **Antigravity IDE**, an agentic development platform. You also have access to terminal-native tools for specific workflows.

## 1. Tool Definitions

| Entity | Role | Best Use Case |
| :--- | :--- | :--- |
| **Antigravity Assistant** (In-Chat) | Collaborative Agent | Real-time pair programming, UI building, and multi-mode planning. |
| **Gemini CLI** | Terminal-Native AI | Fast, iterative local exploration directly from your shell. |
| **Jules** | Asynchronous Background Agent | "Fire-and-forget" heavy lifting (test generation, migrations). |

## 2. Decision Matrix

| Task Type | Recommended Tool | Why? |
| :--- | :--- | :--- |
| **Iterative Coding** | **In-Chat (Direct)** | Best for pair programming, reviewing changes in real-time, and UI "vibe-coding." |
| **Local Refactoring** | **Gemini CLI** | Use `gemini --yolo "prompt"`. Best for fast, multi-file edits on your local machine. |
| **Deep Debugging** | **Gemini CLI** | Use `gemini "prompt"`. Best for local terminal exploration and log analysis. |
| **Heavy Background** | **Jules** | Use `jules remote new --prompt "prompt"`. Best for fire-and-forget tasks (writing tests, big migrations). |
| **Parallel Research** | **Jules** | Use `jules remote new --parallel --prompt "prompt"`. Best for exploring multiple architectural fixes at once. |

---

## 2. Power Prompt Templates

### For Gemini CLI (Local)
**The "YOLO" Refactor:**
> `gemini --yolo "Convert @src/components/TaskItem.js to TypeScript, add an interface for props, and fix any related lint errors."`

**The "Detective" Debug:**
> `gemini "Look at @src/features/tasks/types.ts and @src/features/tasks/logic/recurrenceEngine.ts. Why is the WeekDay enum mismatch causing a crash in TaskEditDrawer?"`

### For Jules (Cloud)
**The "Test Factory":**
> `jules remote new --session "Unit Test Coverage" --prompt "Read every file in @src/utils and write comprehensive Jest unit tests for every exported function. Aim for >80% code coverage. Submit a single PR."`

**The "Framework Migration":**
> `jules remote new --session "Expo Router Migration" --prompt "Identify all files using React Navigation patterns and migrate them to Expo Router v3 patterns. Ensure all shared navigation state is preserved."`

---

## 3. Best Practices for Terminal Prompts
1.  **Use Context Tags**: Always use `@file` or `@folder` to tell the agent exactly where to look.
2.  **Define Done**: Say "Submit a PR" or "Fix all lint errors" so the agent knows when the task is complete.
3.  **Specify Mode**: If using Jules, specify whether it's a standard task or a parallel exploration.
