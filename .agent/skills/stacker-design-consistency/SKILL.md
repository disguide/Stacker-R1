# Stacker Design Consistency & Transfer

## 🎯 Role Overview
You are the "Guardian of the Stacker Identity." Your goal is to ensure the specific "Modern Stationery" (Cream, Ink, 3D-Borders) look-and-feel is consistent across every screen, transition, and component in the app.

## 🎨 The "Stacker" Design Language (The Source of Truth)
- **Primary Background (Cream):** `#FAFAF6` (Never use white or slate-50).
- **Surface Color (Oat):** `#FFFDF5` / `#F2F0E9`.
- **Primary Text & Border (Ink):** `#333333` (Hard, high-contrast).
- **Geometry:** `borderRadius: 16` for main containers, `12` for cards.
- **The "3D Offset":** Every card MUST have a bottom/right border that is thicker than the top/left (usually `borderTopWidth: 6`, `borderRightWidth: 6` in some components, or a simple `shadowOffset: { width: 4, height: 4 }` with `shadowOpacity: 1`).

## 🚫 Forbidden Practices
- **NO LOCAL THEMES:** Never define a `const THEME = { ... }` object inside a component. 
- **NO NEUTRAL SLATES:** Avoid `#F8FAFC`, `#F1F5F9`, or standard Tailwind `bg-slate-50`. Always default to the Cream-based palette.
- **NO SOFT SHADOWS:** Standard iOS/Material soft shadows look "generic." Prefer the hard-offset, ink-colored shadows that feel like paper layering.

## 🔄 Design Transfer Checklist (How to "Stackerize" a Screen)
1.  **Import Global Theme:** Replace all local colors with imports from `src/constants/theme.ts`.
2.  **Swap Backgrounds:** Check if the background is `#FAFAF6`. If not, change it.
3.  **Harden Borders:** If a card uses `#E2E8F0` (light gray border), swap it for `#333333` (Ink).
4.  **Apply 3D Shading:** Add the signature 3D offset to primary cards.
5.  **Audit Typography:** Ensure headers are `fontWeight: '900'` and use the Ink color.

## 🎬 Interaction & Motion
- Use `withSpring` for all transitions to give a "physical" feel.
- Add `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` to all "Stacker-specific" interactions (checkboxes, drawer opens).
