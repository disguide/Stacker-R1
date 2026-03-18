---
name: antigravity-model-selection
description: Expert guide for selecting the optimal AI model and operating mode (Fast vs Planning) for React Native, TypeScript, and Expo development.
---

# Antigravity Model Selection Guide

Use this skill to determine which LLM and operating mode to invoke based on the complexity and scope of the task within the Stacker-R1 project.

## 1. Model & Mode Selection Matrix

## 1. Model & Mode Selection Matrix

## 1. Model & Mode Selection Matrix

Choose your model based on the complexity of the task and your **token budget**.

### 💼 TIER 1: Economy (Fast & Cheap)
Best for UI tweaks, boilerplate, and low-level code review.
- **Gemini 3 Flash**: The fastest. Use for NativeWind, small logic, and one-liners.
- **GPT OSS 12B Medium**: Tiny but smart. Best for algorithmic sanity checks.

### ⚖️ TIER 2: Balanced (Standard Feature Work)
Best for general feature development and medium refactors.
- **Gemini 3.1 Pro Low**: High performance for most daily tasks. Best for TypeScript hooks and storage logic.

### 🏛️ TIER 3: Premium (Complex & High-Reasoning)
Best for massive refactors, deep architectural shifts, and "vibe" perfection. **Warning: High token cost.**
- **Gemini 3.1 Pro High**: For deep debugging and multi-file migrations.
- **Claude Opus 4.6 Thinking**: The "Technical Lead." Best for designing brand-new modules or fine-tuning aesthetics.

### The Modes (Conversation Types)
- **Fast Mode**: Use for single-file edits, style tweaks, and immediate fixes.
- **Planning Mode**: Use for multi-file changes, refactoring, and architectural shifts.

## 2. Operating Environments (The Stacker-R1 Workflow)

| Tool & Mode | Operating Environment | Primary Use Case | Project Application |
| :--- | :--- | :--- | :--- |
| **Gemini CLI (Standard)** | Local / Real-Time | Active Debugging & Exploration. | "Look at `@App.tsx` and explain why my **Expo Router** navigation is passing undefined params." |
| **Gemini CLI (YOLO)** | Local / Instant Execution | Targeted Refactoring. | "Convert `ProfileScreen.js` to TypeScript and add an interface for the user props." |
| **Jules (Standard)** | Cloud VM / Async | Tedious "Homework" Tasks. | "Write **Jest unit tests** for every function in `@src/utils/` and aim for 80% coverage." |
| **Jules (Parallel)** | Cloud VM / Multi-Agent | Stubborn Bug Hunting. | "Run 3 parallel sessions to try different ways of fixing the **race condition** in Stacker authentication." |
| **Jules (Scheduled)** | Cloud VM / Automated | Routine Project Health. | "Scan the codebase every night, **update npm packages**, and fix linting errors." |

## 3. CLI Command Cheat Sheet

### Launch Commands
- `gemini`: Interactive session.
- `gemini --yolo`: Autopilot mode (edits without asking).
- `gemini --init`: Scaffold `.gemini/` folder.
- `gemini -p "[text]"`: One-shot prompt.

### Context & Management
- `@file_or_folder`: Inject context (e.g., `Fix types in @App.tsx`).
- `![command]`: Run terminal command in chat (e.g., `! npx expo start`).
- `/memory add [text]`: Save a persistent rule (e.g., `/memory add Use NativeWind v4`).
- `/plan [task]`: Create a roadmap without generating code yet.

### Jules (Background Agent)
- `/jules [task]`: Assign cloud homework.
- `/jules apply [id]`: Merge cloud changes into local project.
- `/jules diff [id]`: Preview changes side-by-side.
