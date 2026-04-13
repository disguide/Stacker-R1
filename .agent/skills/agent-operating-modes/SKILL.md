---
name: agent-operating-modes
description: Logic for switching between Regular (Standard) and Economy (Disciplined) reasoning modes.
---

# Agent Operating Modes (Meta-Control v2)

Use this skill to determine your reasoning depth, tool selection, and implementation protocol based on the current mode: **Regular** or **Economy**.

---

## 🌓 1. Mode Definitions

### **Regular Mode** (Standard Development)
*   **Models**: Gemini 3.1 Pro (High/Low), Claude 4.6 / Opus, Sonnet 4.6.
*   **Behavior**: Balanced speed and reasoning. Direct file edits allowed.
*   **Goal**: Flexible, iterative development with "human-in-the-loop."
*   **Default**: This is the standard mode for all new sessions unless specified.

### **Economy Mode** (Disciplined / 3.0 Flash)
*   **Model**: **Gemini 3.0 Flash** only.
*   **Behavior**: High speed, lower reasoning depth.
*   **Capacity**: High / Abundant. Use for 90% of routine work.

### **Deep Dive Mode** (Quality Shield for Flash)
*   **Models**: Gemini 3.0 Flash (with high-reasoning logic).
*   **Behavior**: Exhaustive questioning and edge-case discovery to ensure Flash accuracy.
*   **Goal**: Pro-level output using Flash resources through rigorous alignment.

### **Pro / Opus Mode** (High Stakes / Escalation)
*   **Models**: Gemini 3.1 Pro, Claude 4.6 (Opus/Sonnet).
*   **Protocol**: Switch only when requested or recommended for complex refactors. **Must switch back to Flash** immediately after the implementation turn.

### **NC (No Coding)** (One-Shot Lock)
*   **Trigger**: Use when the keyword "**nc**" is mentioned in a request.
*   **Behavior**: **Strictly No Source Code Modifications**. All code-modifying tools (`write_to_file`, `replace_file_content`, etc.) are prohibited from touching project files for the current turn.
*   **Goal**: Pure brainstorming, analysis, or explanation without accidentally touching the codebase.

---

## 🔬 2. Feasibility & Risk Analysis Procedure
Trigger this procedure when the keyword "**analyze**" or "**analyse**" is used. 

Evaluate the request against the following criteria:
1.  **Platform Constraints**: Does this violate "Expo Go Only"? (e.g., trying to use native non-compatible modules).
2.  **Logical Consistency**: Are the requirements contradictory? (e.g., "fast but perfect").
3.  **Performance Risk**: Will this cause memory leaks or UI lag (e.g., heavy looping animations)?
4.  **Tooling Readiness**: Do I have the correct MCP servers (GitHub, etc.) to finish this?

**Required Output Status**:
- **🟩 Feasible**: Clear path to completion.
- **🟨 Risky**: Possible, but has significant technical or performance caveats.
- **🟥 Impossible**: Cannot be done under current project constraints.

---

## 🛠️ 3. The Economy Protocol (Reflective 4-Step)
When in **Economy** mode, you **MUST** follow this sequence:

1.  **Phase 1: Clarification**: Ask the user to confirm the exact scope and goal.
2.  **Phase 2: Reflective Routing (NEW)**: If the task involves architectural changes, race conditions, or complex logic, **outsource the analysis phase** to a higher-reasoning model (Gemini 3.1 Pro) before planning:
    - **Method**: Use `jules` or `gemini --yolo` to analyze the specific problem.
    - **Goal**: Use the "Pro" brain to design the plan, but use the "Flash" hands to type it.
3.  **Phase 3: Planning**: Create a detailed `implementation_plan.md` based on the Pro analysis.
4.  **Phase 4: Implementation**: Implement **ONLY** what was explicitly stated in the approved plan.
5.  **Exception (Quick Mode)**: If the user provides the codeword "**quick**", you may bypass Phase 1 and Phase 3. State your intent clearly and proceed to immediate implementation.

---

## 🔎 4. The Deep Dive Protocol v2.0 (Inquiry-First)
When in **Deep Dive** mode, you **MUST** prioritize discovery and future-proofing over immediate delivery:

1.  **Phase 1: Exhaustive Discovery & "The Why"**: 
    - Do not modify files. 
    - Ask 3-5 clarifying questions about the task, architecture, and edge cases.
    - **Rule**: Every question/suggestion MUST include a **Rationale** section explaining why you are asking it or suggesting it.
2.  **Phase 2: Alignment Check**: 
    - Summarize your understanding back to the user.
    - Wait for a "Go", "Confirmed", or "Crystal Clear" before starting the Implementation Plan.
3.  **Phase 3: Deep Planning & "v2.0 Vision"**: 
    - Create an implementation plan that covers the "How" and "Why".
    - **Rule**: Every plan must include a **v2.0 / Future Vision** section describing what the next iteration or "perfect" version of this feature would look like.
4.  **Phase 4: Execution**: 
    - Proceed only after explicit confirmation.
5.  **Phase 5: Reevaluate**: 
    - If assumptions fail or the scope changes significantly, trigger the **reevaluate** procedure to loop back to Phase 1.

---

## ⚡ 5. Quick Protocol (Low Friction)
Trigger this when the keyword "**quick**" is used.

**Criteria**:
- Task is trivial (CSS adjustment, text copy, simple logic fix).
- No architectural risk.
- High certainty of implementation.

**Action**:
1. Skip the formal `implementation_plan.md`.
2. Skip the Clarification Phase.
3. State: "**Active Mode: Quick.** I will [summary of intent] and execute immediately."
4. Execute the change in a single turn.

---

## 🚀 5. Tool Selection & Execution
Regardless of mode, you must prioritize the **Fastest** and **Cheapest** execution path.

### **Gemini CLI (Local Speed)**
*   **Use when**: You need to run one-shot edits or real-time local tests.
*   **Command**: `gemini --yolo "[TASK] @src/file.ts"`
*   **Economy Mode**: Use CLI to execute small sub-tasks from the plan individually.

### **Jules (Background Automation)**
*   **Use when**: The task is tedious (writing tests, refactoring 10+ files) or requires a long context window.
*   **Command**: `jules remote new --prompt "[TASK]"`
*   **Economy Mode**: Delegate heavy implementation to Jules once the plan is fully approved.

---

## 📋 7. Usage Instructions for the Agent
1.  **Detect Mode**: Always check the user's message for the keywords "**economy**", "**regular**", or "**deepdive**".
2.  **Mode Confirmation**: At the start of your response, state: "Active Mode: [Economy/Regular/Deep Dive]".
3.  **Halt Policy**: In **Economy** and **Deep Dive** modes, you are restricted until specific criteria (Plan approval or Alignment confirmation) are met.
4.  **Reevaluate Trigger**: If the user mentions "**reevaluate**", immediately pause the current phase and return to Phase 1 Discovery.
5.  **CLI/Jules Recommendation**: At the end of every task or plan, explicitly recommend the CLI or Jules command template.
