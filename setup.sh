#!/bin/bash
set -e
echo "=========================================="
echo "  MANU AI — Setup Script (v3-fixed)"
echo "=========================================="
echo ""

# ── Step 1: Check Java ───────────────────────────────────────────────────────
echo "[1/5] Checking Java version..."
java -version 2>&1 | head -1 || { echo "ERROR: Java not found. Install OpenJDK 17."; exit 1; }

# ── Step 2: Install deps ──────────────────────────────────────────────────────
echo ""
echo "[2/5] Installing dependencies..."
if command -v yarn &>/dev/null; then
  yarn install --frozen-lockfile
else
  npm install --legacy-peer-deps
fi

# ── Step 3: Patch subproject build.gradle files ───────────────────────────────
# gesture-handler, reanimated, safe-area-context still reference old react-native artifact
echo ""
echo "[3/5] Patching subproject build.gradle files..."
for f in \
  node_modules/react-native-gesture-handler/android/build.gradle \
  node_modules/react-native-reanimated/android/build.gradle \
  node_modules/react-native-safe-area-context/android/build.gradle ; do
  if [ -f "$f" ]; then
    echo "  Patching: $f"
    sed -i "s|['\"]com\.facebook\.react:react-native:+['\"]|'com.facebook.react:react-android:0.74.3'|g" "$f"
    sed -i "s|['\"]com\.facebook\.react:react-native:[^'\"]*['\"]|'com.facebook.react:react-android:0.74.3'|g" "$f"
    sed -i "s|['\"]com\.facebook\.react:react-android['\"]|'com.facebook.react:react-android:0.74.3'|g" "$f"
  else
    echo "  WARN: $f not found (skipping)"
  fi
done

# ── Step 4: Gradle wrapper jar ────────────────────────────────────────────────
echo ""
echo "[4/5] Setting up Gradle wrapper jar..."
cd android
if [ ! -f "gradle/wrapper/gradle-wrapper.jar" ]; then
  echo "  Downloading gradle-wrapper.jar..."
  mkdir -p gradle/wrapper
  curl -sL "https://raw.githubusercontent.com/gradle/gradle/v8.7.0/gradle/wrapper/gradle-wrapper.jar" \
    -o gradle/wrapper/gradle-wrapper.jar 2>/dev/null && echo "  OK" \
    || echo "  WARNING: Could not download. Copy gradle-wrapper.jar manually into android/gradle/wrapper/"
fi

# ── Step 5: Generate debug keystore ──────────────────────────────────────────
echo ""
echo "[5/5] Generating debug keystore..."
if [ ! -f "app/debug.keystore" ]; then
  keytool -genkey -v -keystore app/debug.keystore \
    -storepass android -alias androiddebugkey \
    -keypass android -keyalg RSA -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" 2>/dev/null \
    && echo "  Keystore created." \
    || echo "  WARNING: keytool not found. Keystore not generated."
fi
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete! Now run:"
echo ""
echo "  # Step A: Build JS bundle"
echo "  npx react-native bundle \\"
echo "    --platform android --dev false \\"
echo "    --entry-file index.js \\"
echo "    --bundle-output android/app/src/main/assets/index.android.bundle \\"
echo "    --assets-dest android/app/src/main/res"
echo ""
echo "  # Step B: Build APK"
echo "  cd android && ./gradlew assembleDebug --no-daemon"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
