---
description: No Coding Protocol (nc)
---

# NC Mode (No Coding) Protocol

This protocol is activated whenever you use the keyword **"nc"** in your request. 

### Core Rules:
1. **No Code Modification**: I will NOT use any tools to create, modify, or delete files (`write_to_file`, `replace_file_content`, `multi_replace_file_content`, etc.).
2. **Confirm Understanding**: I will always repeat your request back to you in my own words to prove I have understood your intent 100%.
3. **Brainstorming & Answers**: I will focus on cognitive tasks like brainstorming, explaining logic, or answering questions WITHOUT proposing code changes.
4. **NC Confirmation**: I will explicitly state "Fulfilling request in NC mode (No Coding)" at the start of my response.

### When to use:
- When you want to discuss an idea without me immediately writing code.
- When you want a logical explanation of how something works.
- When you want to brainstorm UI/UX patterns without implementation.

### Model Recommendation:
- **Gemini 3.1 Pro (Low)** or **PT OSS 12B Medium** are generally best for NC sessions as they are fast and conversational.
