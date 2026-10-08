/*
 * common —— 可被各应用复用的公共库。
 *
 * 用 java-library 插件，提供 api / implementation 的依赖隔离：
 *   - api            暴露给依赖本库的模块（会传递到它们的编译期）
 *   - implementation 仅本库内部使用，不外泄
 */

plugins {
    `java-library`
}

group = "com.center"
version = "1.0.0"

dependencies {
    // 库里如果需要测试，同样自行声明测试依赖。
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
