import java.awt.Color
import java.awt.RenderingHints
import java.awt.geom.Path2D
import java.awt.image.BufferedImage
import javax.imageio.ImageIO

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.kambei.habitikami"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.kambei.habitikami"
        minSdk = 26
        targetSdk = 35
        versionCode = 15
        versionName = "5.1.0"

        // Default PWA URL — override in local.properties if needed
        buildConfigField("String", "PWA_URL", "\"https://habitikami.kambei.dev\"")
    }

    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("KEYSTORE_PATH") ?: "keystore.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias = System.getenv("KEY_ALIAS") ?: ""
            keyPassword = System.getenv("KEY_PASSWORD") ?: ""
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
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
    implementation("androidx.recyclerview:recyclerview:1.3.2")

    // Coroutines for async widget updates
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}

abstract class GenerateIconTask : DefaultTask() {
    @get:Internal
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val size = 512
        val image = BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB)
        val g = image.createGraphics()

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        // 1. Background (Original color #7C3AED)
        g.color = Color.decode("#7C3AED")
        g.fillRect(0, 0, size, size)

        // 2. Logo Drawing (Based on your ic_launcher_foreground.xml)
        val scale = size / 108.0
        g.scale(scale, scale)

        val path = Path2D.Double()
        path.moveTo(31.0, 63.928)
        path.curveTo(31.0, 63.928, 37.4, 61.628, 44.0, 61.628)
        path.curveTo(51.2, 61.628, 56.0, 63.928, 56.0, 63.928)
        path.lineTo(85.0, 34.928)
        path.curveTo(85.0, 34.928, 80.2, 32.628, 73.0, 32.628)
        path.curveTo(66.4, 32.628, 60.0, 34.928, 60.0, 34.928)
        path.lineTo(31.0, 63.928)
        path.closePath()

        g.color = Color.WHITE
        g.fill(path)
        g.dispose()

        val outputFile = outputDir.file("play_store_512.png").get().asFile
        ImageIO.write(image, "png", outputFile)

        println("SUCCESS: Icon generated at ${outputFile.absolutePath}")
    }
}

abstract class GenerateFeatureGraphicTask : DefaultTask() {
    @get:Internal
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val width = 1024
        val height = 500
        val image = BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB)
        val g = image.createGraphics()

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        // 1. Background
        g.color = Color.decode("#7C3AED")
        g.fillRect(0, 0, width, height)

        // 2. Logo Drawing
        // We want the logo to be around 250px tall
        val logoHeightInUnits = 63.928 - 32.628
        val targetLogoHeight = 250.0
        val scale = targetLogoHeight / logoHeightInUnits
        
        val logoWidthInUnits = 85.0 - 31.0
        val targetLogoWidth = logoWidthInUnits * scale
        
        // Center the logo
        val tx = (width - targetLogoWidth) / 2.0 - (31.0 * scale)
        val ty = (height - targetLogoHeight) / 2.0 - (32.628 * scale)
        
        g.translate(tx, ty)
        g.scale(scale, scale)

        val path = Path2D.Double()
        path.moveTo(31.0, 63.928)
        path.curveTo(31.0, 63.928, 37.4, 61.628, 44.0, 61.628)
        path.curveTo(51.2, 61.628, 56.0, 63.928, 56.0, 63.928)
        path.lineTo(85.0, 34.928)
        path.curveTo(85.0, 34.928, 80.2, 32.628, 73.0, 32.628)
        path.curveTo(66.4, 32.628, 60.0, 34.928, 60.0, 34.928)
        path.lineTo(31.0, 63.928)
        path.closePath()

        g.color = Color.WHITE
        g.fill(path)
        g.dispose()

        val outputFile = outputDir.file("play_store_1024x500.png").get().asFile
        ImageIO.write(image, "png", outputFile)

        println("SUCCESS: Feature Graphic generated at ${outputFile.absolutePath}")
    }
}

tasks.register<GenerateIconTask>("generatePlayStoreIcon") {
    group = "help"
    description = "Generates a 512x512 icon for Google Play Store based on existing vector assets."
    outputDir.set(project.layout.projectDirectory)
}

tasks.register<GenerateFeatureGraphicTask>("generateFeatureGraphic") {
    group = "help"
    description = "Generates a 1024x500 feature graphic for Google Play Store."
    outputDir.set(project.layout.projectDirectory)
}
