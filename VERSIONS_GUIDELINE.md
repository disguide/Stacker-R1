# Stacker R1: Version & Architecture Guidelines

This document outlines what is possible and what is restricted in Stacker R1 based on the current technology stack: **Expo SDK 54** and **React Native 0.81 (New Architecture Mandatory).**

---

## 🏗 The Core Reality: The New Architecture
Starting with Expo SDK 54 (and enforced entirely in SDK 55), **React Native's New Architecture (Bridgeless Mode, Fabric, TurboModules) is enabled by default and will soon be mandatory.**

This means the old "bridge" that allowed JavaScript to talk to Native code asynchronously is being deprecated. All libraries must support synchronous, direct communication via JSI (JavaScript Interface) and the new build systems.

---

## 🚫 What You CANNOT Do (The Restrictions)

### 1. You CANNOT use WatermelonDB (Out-of-the-Box)
- **Why:** WatermelonDB is deeply tied to the Legacy Architecture and old JSI bindings. While there are open pull requests to fix it, it currently fails Expo's autolinking in RN 0.77+ and crashes on initialization in Bridgeless Mode.
- **Alternative:** Stick to the defined "Split Storage Strategy" using `react-native-mmkv` (which is fully rewritten for the New Architecture) and `Zustand`.

### 2. You CANNOT easily use old, unmaintained Native Modules
- **Why:** Any library that heavily relies on the old React Native Bridge (e.g., older Bluetooth, complex file system libraries, or deprecated UI components) will likely fail to build or crash at runtime. The "Interop Layer" exists, but it is not flawless.
- **Rule of Thumb:** Always check `reactnative.directory` or run `npx expo-doctor`. If a library says "Untested on New Architecture" or hasn't been updated in 2 years, find an alternative.

### 3. You CANNOT rely on the old `FlatList` for massive datasets
- **Why:** While it still works, `FlatList` struggles with the performance required for a "Google Tasks clone" with potentially hundreds of recurring items.
- **Alternative:** Use `@shopify/flash-list`. It is built specifically for the New Architecture, recycles views efficiently, and is the industry standard.

### 4. You CANNOT use `Animated` API for complex gestures
- **Why:** The built-in React Native `Animated` API does not run entirely on the UI thread in the New Architecture in the same seamless way as modern tools.
- **Alternative:** Exclusively use `react-native-reanimated` (v3+) and `react-native-gesture-handler` for swipe-to-delete, drag-and-drop, and Sprint mode transitions.

---

## ✅ What You CAN Do (The Superpowers)

### 1. You CAN achieve 120fps UI & Animations
Because you are on the New Architecture with Bridgeless Mode, JavaScript and Native code communicate synchronously.
- **Tools:** `react-native-reanimated` and `react-native-gesture-handler` (v2+) work flawlessly here. You can build complex, interruptible swipe-to-complete animations that feel 100% native.

### 2. You CAN build custom Native Modules easily
If you need features that React Native doesn't have (e.g., Apple's Screen Time API for the "Sprint" focus mode restrictions):
- **How:** Use the **Expo Modules API**. It is built specifically for the New Architecture and allows you to write Swift/Kotlin code directly in your project without needing to touch complex C++ JSI bindings.

### 3. You CAN handle massive local data synchronously
- **How:** `react-native-mmkv` is fully supported on the New Architecture. You can store tens of thousands of tasks, read them synchronously on app launch, and populate a `FlashList` instantly without the asynchronous delay of `AsyncStorage` or SQLite.

### 4. You CAN use Expo Router for deep linking & complex layouts
- **How:** Expo Router v4 is optimized for the New Architecture. You can build complex nested layouts (like the Main List -> Sprint Mode transition) with file-based routing and automatic deep linking.

### 5. You CAN use high-performance graphics
- **How:** `@shopify/react-native-skia` is fully compatible. If the "Sprint Mode" requires complex UI elements (like a morphing focus timer, blurs, or custom progress circles), Skia runs directly on the GPU and is designed for this architecture.

---

## 📋 Summary Checklist for New Features/Libraries

Before adding a new feature or `npm` package, ask:
1. **Does it require native code?** If yes, does it explicitly support the New Architecture / RN 0.77+?
2. **Does it pass `npx expo-doctor`?** (Run this command after installing to verify).
3. **Can it be done with MMKV + Zustand instead of a heavy database?** (Stick to the existing split storage strategy).
4. **Is it using Reanimated for UI thread performance?**
