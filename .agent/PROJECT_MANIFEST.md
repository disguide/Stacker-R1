# Stacker R1: Project Manifest (v3)

## 📱 1. Project Context
- **Name**: Stacker R1.
- **Environment**: **Expo Go (SDK 54)**.
- **Architecture**: **New Architecture Enabled** (`newArchEnabled: true`).
- **STRICT PROHIBITION**: Never use `browser_subagent`. App is Native-only.

## 🛠️ 2. Technology Stack (Verified)
- **Navigation**: Expo Router (File-based).
- **Styling**: NativeWind (Tailwind). **Aliases**: `@/` maps to `./src/`.
- **Database**: WatermelonDB + Supabase.
- **Animations**: `react-native-reanimated` (~4.1.1) + `react-native-worklets`.
- **Keyboard**: `react-native-keyboard-controller`.

## ⚠️ 3. Compatibility Matrix

### 🟢 100% Compatible (Confirmed in Project)
- **Animations**: `react-native-reanimated` (v4 style), `moti`.
- **Logic**: `react-native-worklets`.
- **Icons**: `lucide-react-native`, `@expo/vector-icons`.
- **Storage**: `expo-secure-store`, `@react-native-async-storage/async-storage`.
- **Media**: `expo-av`, `expo-image-picker`.

### 🟡 Caution (Specific Rules)
- **SVGs**: Use `react-native-svg`. No custom SVG transformer is configured in the root; do not assume `.svg` imports work directly.
- **WatermelonDB**: Maintain schema versions carefully.
- **Aliases**: Always use `@/` for imports from the `src` directory.

### 🔴 Forbidden / Non-Compatible
- **Web**: No browser tools.
- **Legacy Animation**: NEVER use `react-animated` or legacy core `Animated` hooks unless requested for trivial cases.
- **Native Link Required**: Do not add libraries like `react-native-fast-image` or `react-native-video`. Use the `expo-` equivalents.
- **Old Arch Libs**: Avoid libraries that are strictly incompatible with the New Architecture.
