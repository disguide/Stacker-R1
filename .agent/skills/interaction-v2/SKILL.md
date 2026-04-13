---
name: interaction-v2
description: Triggers for Regular and Economy mode switches and multi-step workflow commands.
---

# Interaction Keywords (Protocol v2)

Use these keywords to control my behavior and reasoning depth.

| Keyword | Action | When to use |
| :--- | :--- | :--- |
| **`economy`** | Switch to **Economy Mode**. | Use for routine, well-defined tasks or when you want the fastest response. |
| **`regular`** | Switch to **Regular Mode**. | Use for complex features, UI/UX "Vibe" checks, or deep refactors. |
| **`deepdive`** / **`dive`** | Switch to **Deep Dive Mode**. | Use when you want exhaustive questioning and technical alignment before code is touched. |
| **`nc`** | Trigger **One-Shot No-Code Lock** for the current turn. | When you want to discuss logic or ideas without touching any files. |
| **`analyze`** / **`analyse`** | Trigger **Feasibility & Risk Analysis**. | To see if a specific task or idea is technically possible in the current project. |
| **`confirm`** | Trigger **Clarification Phase** in Economy Mode. | When you want to ensure we are aligned on the "Definition of Done." |
| **`plan`** | Trigger **Planning Phase** in Economy Mode. | Before any code is written, to define the roadmap. |
| **`quick`** | **Skip Protocol / Low Friction**. | Use for trivial, certain-to-work changes where no planning is needed. Just state and execute. |
| **`done`** | Approve a plan and trigger **Implementation Phase**. | Once you are happy with the `implementation_plan.md`. |
| **`reevaluate`** | Trigger **Deep Dive Reevaluation**. | Use when the current plan or discovery isn't working and you want to start over at Phase 1. |
| **`v2`** | Request a **Future Vision** breakdown. | Ask me what the next, more advanced version of the current feature would look like. |

---

## 🛠️ Usage Patterns

### **1. Switching Modes**
- "Let's work in **economy** mode for this minor CSS fix."
- "Switch to **regular** mode, I need a deep architectural review of this hook."
- "Let's do a **deepdive** on the notifications engine; I feel like we're missing edge cases."

### **2. Economy Workflow**
1. **User**: "economy - add a 'Clear All' button to the task list."
2. **Agent**: "Active Mode: Economy. **Phase 1: Clarification**. Should this button clear *all* tasks or just the *completed* ones?"
3. **User**: "Just completed."
4. **Agent**: "**Phase 2: Planning**. [Creates Plan Artifact]. Proposing a 'Clear Completed' button in the footer..."
5. **User**: "**done** - proceed."
6. **Agent**: "**Phase 3: Implementation**. [Applying only the approved fix]. I recommend using the CLI: `gemini --yolo \"Add clear completed button @src/features/home/components/TaskListSection.tsx\"`."
