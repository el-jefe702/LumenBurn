plugins {
    id("com.android.application") version "9.2.1" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.20" apply false
}

// Move build directory outside of OneDrive to avoid file lock issues
allprojects {
    layout.buildDirectory.set(file("C:/temp/android_builds/DepthForgeAndroid/${project.name}"))
}
