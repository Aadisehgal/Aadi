NOTE: gradle-wrapper.jar is required but not included in source control.

To generate it, run ONE of the following from the project root:

  Option 1 (Recommended — if Gradle is installed):
    cd android && gradle wrapper --gradle-version 8.7

  Option 2 (Copy from any React Native project):
    Copy gradle-wrapper.jar from:
    android/gradle/wrapper/gradle-wrapper.jar

  Option 3 (Download directly):
    curl -L https://github.com/gradle/gradle/raw/v8.7.0/gradle/wrapper/gradle-wrapper.jar \
      -o android/gradle/wrapper/gradle-wrapper.jar

After placing the jar, run:
    cd android && ./gradlew assembleRelease
