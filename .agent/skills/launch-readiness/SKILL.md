---
name: launch-readiness
description: Expert guide for taking Stacker-R1 from development to production on iOS and Android.
---

# 🚀 Launch Readiness Skill

Use this skill when we are preparing to move from local development to a "Production" launch on the App Store (Apple) and Play Store (Google).

## 📋 1. The Pre-Flight Checklist

### 🎨 Visual & Identity
- [ ] **Icon**: 1024x1024 PNG (No transparency for iOS).
- [ ] **Splash Screen**: 2048x2048 PNG (Centered logo, solid background).
- [ ] **Colors**: Verify 3D shadows work on physical devices (not just emulators).

### ⚙️ Technical & Security
- [ ] **Supabase RLS**: Ensure every table has "Row Level Security" enabled and policies match the code.
- [ ] **Redirect URLs**: Add `stacker://auth` and your production web URL to Supabase Auth settings.
- [ ] **Bundle IDs**: 
    - iOS: `com.stacker.app` (must match Apple Developer portal).
    - Android: `com.stacker.app` (must match Play Console).
- [ ] **Cleanup**: Run `npx expo-doctor` and check for unused dependencies.

### ⚖️ Legal & Metadata
- [ ] **Privacy Policy**: Required for both stores (Hosting on a simple GitHub Page is okay).
- [ ] **Support URL**: A way for users to contact you.
- [ ] **Store Description**: Compelling text and 3-5 screenshots per device size.

---

## 🛠️ 2. The EAS Build Flow

EAS (Expo Application Services) is how we build the actual `.ipa` and `.aab` files.

1.  **Production Build**: `eas build --platform all --profile production`
2.  **Release**:
    - **iOS**: Submit to **TestFlight** for internal testing first.
    - **Android**: Upload to **Internal Testing** in Google Play Console.

---

## 💡 Pro Tips

> [!TIP]
> **Apple Enrollment**: If you are having trouble enrolling, try using the **Apple Developer App** on an iPhone instead of the website. It’s usually much smoother and allows for identity verification via the camera.

> [!IMPORTANT]
> **Google Play 20-Tester Rule**: New personal accounts on Google Play now require 20 testers to opt-in for 14 days before you can apply for "Production" access. We should start gathering emails for your "Internal Testing" group immediately!
