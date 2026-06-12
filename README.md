# MANU AI — Android APK Build Guide

A production-grade Android AI Assistant built with React Native CLI 0.74.3 + TypeScript.

---

## 🚀 Quick Build via GitHub Actions

This is the **recommended** way to get a working APK.

### Steps:
1. Create a **new GitHub repository** (private or public).
2. Push this entire folder to the repo:
   ```bash
   cd manu-ai-fixed
   git init
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   ```
3. Go to **Actions** tab on GitHub → workflow `Build APK` runs automatically.
4. After ~8–15 min, download **`manu-ai-debug-apk`** artifact from the workflow run.
5. Unzip and install `app-debug.apk` on your phone (enable "Install from unknown sources").

> **Build outputs:** `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔧 What was fixed in this build

| Issue | Fix |
|---|---|
| AGP version mismatch | Pinned to **AGP 8.6.0** + **Gradle 8.7** |
| Android SDK | Upgraded to **compileSdk 35 / targetSdk 35** |
| `react-native:+` resolution fails | CI patches `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context` to use `com.facebook.react:react-android:0.74.3` |
| Missing Gradle binary | CI installs Gradle 8.7 manually (no wrapper download needed) |
| Missing JS bundle in APK | CI runs `npx react-native bundle …` **before** `assembleDebug` |
| No GLB avatar files | App falls back to **SVG-only avatar** (see `AvatarScreen.tsx`) |
| Generic icon | New **MANU AI branded** icon (white "M" on dark purple→blue gradient) — replace PNGs in `android/app/src/main/res/mipmap-*/` to customize |
| AdMob ID hardcoded | Moved to `strings.xml` → `@string/admob_app_id` (currently Google test ID) |
| Groq API key | Empty by default — user enters in **Settings → AI Model → Groq API Key**; saved to `react-native-encrypted-storage` (AES-256, Android Keystore) |

---

## 🔑 Groq API Key
Open the app → **Settings** → **AI Model** → **Groq API Key** → paste key → **Save**.
Key is encrypted at rest using **Android Keystore** (`react-native-encrypted-storage`).
Get a key: <https://console.groq.com/keys>

## 📺 AdMob App ID (placeholder)
`strings.xml` ships with Google's test app ID (`ca-app-pub-3940256099942544~3347511713`).
To use your own ID, edit `android/app/src/main/res/values/strings.xml`:
```xml
<string name="admob_app_id">ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
```

## 🎨 Custom App Icon
Replace these PNGs with your own (same dimensions):
```
android/app/src/main/res/mipmap-mdpi/ic_launcher.png        (48×48)
android/app/src/main/res/mipmap-hdpi/ic_launcher.png        (72×72)
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png       (96×96)
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png      (144×144)
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png     (192×192)
```
Same for the `ic_launcher_round.png` variants.

---

## 🧪 Local Build (optional)

Requires: Node 18, Java 17, Android SDK 35, Gradle 8.7

```bash
# 1. Install JS deps
npm install --legacy-peer-deps

# 2. Patch sub-project gradle files (CI does this automatically)
for f in \
  node_modules/react-native-gesture-handler/android/build.gradle \
  node_modules/react-native-reanimated/android/build.gradle \
  node_modules/react-native-safe-area-context/android/build.gradle ; do
    sed -i.bak \
      -e "s|['\"]com\.facebook\.react:react-native:+['\"]|'com.facebook.react:react-android:0.74.3'|g" \
      -e "s|['\"]com\.facebook\.react:react-native:[^'\"]*['\"]|'com.facebook.react:react-android:0.74.3'|g" \
      -e "s|['\"]com\.facebook\.react:react-android['\"]|'com.facebook.react:react-android:0.74.3'|g" \
      "$f"
done

# 3. Create debug keystore
cd android/app
keytool -genkey -v -keystore debug.keystore -storepass android \
  -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 \
  -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
cd ../..

# 4. Bundle JS
mkdir -p android/app/src/main/assets
npx react-native bundle \
  --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# 5. Build APK
cd android && gradle assembleDebug --no-daemon
# Output: app/build/outputs/apk/debug/app-debug.apk
```

---

## 📁 Project Structure
```
manu-ai-fixed/
├── .github/workflows/build-apk.yml    ← CI workflow (Gradle 8.7, patch step, debug APK)
├── android/
│   ├── build.gradle                   ← AGP 8.6.0, SDK 35
│   ├── gradle.properties              ← Hermes on, new arch off
│   ├── settings.gradle                ← Includes 3 RN libs as sub-projects
│   ├── gradle/wrapper/gradle-wrapper.properties  ← Gradle 8.7
│   └── app/
│       ├── build.gradle               ← Debug-signed release block
│       └── src/main/
│           ├── AndroidManifest.xml    ← AdMob uses @string/admob_app_id
│           ├── java/com/manu/ai/      ← MainActivity / MainApplication / BootReceiver
│           └── res/
│               ├── mipmap-*/          ← MANU AI branded icons (5 densities)
│               └── values/strings.xml ← app_name + admob_app_id
├── src/                               ← TypeScript app code (unchanged)
├── App.tsx
├── index.js
├── package.json                       ← three/r3f removed (SVG-only avatar)
└── metro.config.js
```

---

## 🐞 Troubleshooting

| Symptom | Fix |
|---|---|
| `react-native:+` not found in subproject | Patch step didn't run — re-run workflow |
| `Could not find com.facebook.react:react-android:` | Ensure `mavenCentral()` is in `allprojects.repositories` (it is) |
| `compileSdkVersion not specified` for sub-lib | Already set via `rootProject.ext.compileSdkVersion = 35` |
| APK installs but crashes on launch | Check `adb logcat` for missing JS bundle — make sure `assembleDebug` ran **after** `react-native bundle` |
| Groq says "Invalid API key" | Re-enter key in Settings, confirm no trailing whitespace |

---

## 🔒 Storage Keys Reference
| Storage | Key | Purpose |
|---|---|---|
| Encrypted (Android Keystore) | `groq_api_key` | Groq API key (AES-256) |
| Encrypted (Android Keystore) | `voice_profiles` | Voice fingerprint data |
| Encrypted (Android Keystore) | `auth_pin` | App PIN |
| MMKV | `app_settings_v3` | Assistant/user profile, model |
| MMKV | `alwaysSpeakResponses` | TTS auto-speak toggle |
| MMKV | `avatarCuteMode` | Cute mode: off/mild/full |
| MMKV | `isPremiumUnlocked` | IAP state (stub) |
| SQLite | `manu_ai.db` | Conversations, messages, memories, notes, docs, analytics |
