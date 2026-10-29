plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.eventpix.tv.player"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.eventpix.tv.player"
        minSdk = 21
        targetSdk = 34
        // En CI (workflow "APK de la TV") la versión sale del número de corrida:
        // versionCode = 100 + N y versionName = 2.3.N, así cada APK publicado es
        // mayor que el anterior y la actualización desde la TV lo reconoce.
        // Compilado a mano (sin -PtvBuildNumber) queda en 2.3.0 / 3.
        val ciBuild = (project.findProperty("tvBuildNumber") as String?)?.toIntOrNull()
        versionCode = if (ciBuild != null) 100 + ciBuild else 3
        versionName = if (ciBuild != null) "2.3.$ciBuild" else "2.3.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Firma de los APK publicados. Tiene que ser SIEMPRE la misma: Android solo
    // deja actualizar una app con un APK firmado con la misma clave. El
    // workflow "APK de la TV" pasa la clave con -PtvKeystore=<archivo> (antes se
    // usaba la clave de depuración automática, que cambiaba en cada compilación).
    val tvKeystore = (project.findProperty("tvKeystore") as String?)?.let { file(it) }
    signingConfigs {
        if (tvKeystore != null) {
            create("tv") {
                storeFile = tvKeystore
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        debug {
            if (tvKeystore != null) signingConfig = signingConfigs.getByName("tv")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    // CI corre lintDebug solo con NewApi: frena el APK si se usa una función de
    // Android más nueva que minSdk (21) sin chequear la versión. Esos errores
    // cierran la app al instante en equipos con Android viejo.
    lint {
        checkOnly += "NewApi"
        abortOnError = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Kotlin Coroutines (watchdog)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
