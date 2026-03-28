---
name: interaction-commands
description: A set of "Magic Keywords" and commands that the user can use to trigger specific agent behaviors and response formats.
---

# Interaction Commands Skill

This skill defines a set of trigger words that you (the USER) can use to control how I (the AGENT) respond to your requests. 

## 1. Core Commands

| Keyword / Command | Behavior | When to use |
| :--- | :--- | :--- |
| **`suggestion`** / **`/suggest`** | I will recommend the best **AI Model**, **Operating Mode**, and **Execution Path**. I will provide the exact terminal command if recommending Gemini CLI or Jules. | When you want to ensure we are using the right level of "brainpower" and the fastest environment for the task. |
| **`repeat`** / **`/confirm`** | I will repeat your request back to you in my own words to confirm 100% understanding. | Before complex refactors or when the task has many subtle requirements. |
| **`roadmap`** / **`/plan`** | I will create or update an `implementation_plan.md` artifact *before* touching any code. | For multi-file changes or deep architectural shifts. |
| **`relevance`** / **`/files`** | I will list all files I intend to read/modify and explain *why* they are relevant to your task. | To sanity-check my approach before I start "eating" your tokens. |
| **`aesthetic`** / **`/vibe`** | I will prioritize my "Look & Feel" skills and deliver a high-impact, distinctive visual identity. | When you want to "wow" users with premium 3D motion and glassmorphism. |
| **`aesthetic-lite`** | I will deliver a premium look using *only* safe properties (shadows, typography, simple fades) with ZERO performance risk. | When you are worried about overkill or breaking older mobile devices. |

| **`test-first`** / **`/tdd`** | I will outline the exact unit/integration tests I plan to write before implementing the fix. | For critical business logic like recurrence engines or storage services. |
| **`clean`** / **`/simple`** | I will invoke the **`code-simplifier`** skill to ensure my proposed solution is as elegant and readable as possible. | When you want to prevent future technical debt. |
| **`nc`** | I will activate the **No Coding Protocol**. I will NOT change any code. I will repeat your request back to you in my own words to confirm 100% understanding, then brainstorm solutions. | When you want to discuss ideas or brainstorm without me touching your files. |

---

## 📋 Catalog of Options (For `/suggestion`)

When you use **`suggestion`**, I will recommend the best path based on the **Antigravity** ecosystem.

### 1. Choose Your Brain (Model)
Pick based on the task's complexity vs. your **token budget**:

- **Economy**: **Gemini 3 Flash** (Styling/Fast) or **GPT OSS 12B Medium** (Logic review).
- **Balanced**: **Gemini 3.1 Pro Low** (Standard feature development).
- **Premium**: **Gemini 3.1 Pro High** (Deep refactors) or **Claude Opus 4.6 Thinking** (Architectural design).
mediate, single-turn assistance.
- **Planning**: For autonomous, multi-step execution.

### 2. Choose Your Execution Path
- **In-Chat (Antigravity Assistant)**: Collaborative, real-time work in the IDE.
- **Gemini CLI**: Terminal-native AI for local speed.
    - *Command Template*: `gemini --yolo "[PROMPT]"`
- **Jules**: Background agent for heavy/asynchronous tasks.
    - *Command Template*: `jules remote new --prompt "[PROMPT]"`

## 2. Usage Instructions for the Agent

1.  **Monitor Input**: Always check the user's latest message for these keywords or slash commands.
2.  **Immediate Priority**: If a command is found, perform that specific action *first* before any other tool calls (unless research is required to fulfill the command).
3.  **Explicit Confirmation**: When fulfilling a command, explicitly state: "Fulfilling command: [Command Name]."

## 3. Model, Mode & Tool Options (The Recommendation Catalog)
When you use a command like **`suggestion`**, I will recommend an option from this catalog:

| Task Type | Model Recommendation | Mode | Implementation Method |
| :--- | :--- | :--- | :--- |
| **Real-time Tweaks** | Gemini 3 Flash | Fast | In-Chat (Direct) / CLI |
| **Targeted Refactor** | Gemini 3 Flash | Planning | In-Chat (Direct) / CLI (YOLO) |
| **Deep Logical Fix** | Gemini 3.1 Pro (High)| Planning | In-Chat (Direct) / CLI |
| **Massive / Heavy** | Claude 4.6 / GPT OSS | Planning | Jules (Standard/Parallel)|
| **Routine / Tests** | Gemini 3.1 Pro (Low) | Planning | Jules (Standard) |
