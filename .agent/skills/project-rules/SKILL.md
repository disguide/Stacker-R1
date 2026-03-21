---
name: project-rules
description: Project-specific rules, constraints, and operational guidelines for Stacker-R1.
---

# Project Rules & Constraints

This skill documents the "Golden Rules" for developing the Stacker-R1 project. These rules must be followed to ensure development stability and prevent tool-chain errors.

## 📱 1. Platform Constraints

### **Rule 1: Expo Go Only (No Web)**
- **Constraint**: This project is built specifically for **Expo Go** (React Native).
- **Instruction**: **NEVER** attempt to open the application URL (e.g., `localhost:8081`, `localhost:19006`) in a web browser or use the `browser_subagent` to interact with the app's UI. 
- **Reason**: The app uses Native modules and configurations that are not compatible with standard web browsers. Verification should be done via terminal logs or by asking the user to verify on their physical device/emulator.

## 🛠️ 2. Development Guidelines
*(Add more rules here as they emerge)*
