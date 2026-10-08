// 根项目只声明插件版本、不应用；各子项目按需在自身的 build.gradle.kts 里 apply。
plugins {
    alias(libs.plugins.kotlin.jvm) apply false
}

subprojects {
    // 依赖仓库统一在根项目声明，子项目无需重复。
    repositories {
        mavenCentral()
    }

    // 统一测试运行器；测试依赖由各应用自行声明。
    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
    }
}
