# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# SQLite
-keep class net.sqlcipher.** { *; }
-keep class org.sqlite.** { *; }
-keep class io.liteglue.** { *; }

# MMKV
-keep class com.tencent.mmkv.** { *; }

# React Native Encrypted Storage
-keep class com.emeraldsanto.encryptedstorage.** { *; }

# React Native Voice
-keep class com.wenkesj.voice.** { *; }

# React Native TTS
-keep class com.reelejames.tts.** { *; }

# React Native FS
-keep class com.rnfs.** { *; }

# Notifee
-keep class app.notifee.** { *; }

# Google Ads
-keep class com.google.android.gms.ads.** { *; }

# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata { *; }

# Crashlytics
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native modules
-keep class com.swmansion.** { *; }
-keep class com.th3rdwave.** { *; }
-keep class io.invertase.** { *; }
-keep class com.brentvatne.** { *; }
-keep class com.oblador.** { *; }
-keep class org.pgsqlite.** { *; }
-keep class com.emeraldsquare.** { *; }

# Kotlin
-keep class kotlin.** { *; }
-keepclassmembers class **$WhenMappings { *; }

# Groq / Axios / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
