plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.kambei.habitikami"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.kambei.habitikami"
        minSdk = 26
        targetSdk = 34
        versionCode = 3
        versionName = "3.0.0"

        // Default PWA URL — override in local.properties if needed
        buildConfigField("String", "PWA_URL", "\"https://habitikami.kambei.dev\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // TWA (Trusted Web Activity)
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
    implementation("androidx.browser:browser:1.8.0")

    // Core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")

    // Coroutines for async widget updates
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
