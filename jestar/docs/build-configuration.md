# 构建配置说明

构建配置分为三层：**`settings.gradle.kts`（发现项目）→ 根 `build.gradle.kts`（共享配置）
→ 各应用的 `build.gradle.kts`（应用自身配置）**。

---

## 1. settings.gradle.kts —— 自动发现 apps/ 与 packages/ 下的子项目

```kotlin
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "jestar"

// apps/ = 应用，packages/ = 可复用库；每个直接子目录只要含 build.gradle.kts 就注册为子项目。
listOf("apps", "packages").forEach { group ->
    file(group)
        .listFiles()
        ?.filter { it.isDirectory && it.resolve("build.gradle.kts").isFile }
        ?.sortedBy { it.name }
        ?.forEach { dir ->
            include(dir.name)
            project(":${dir.name}").projectDir = dir
        }
}
```

规则：

- 扫描 `apps/` 与 `packages/` 的**直接子目录**；
- 只要目录里存在 `build.gradle.kts`，就注册为一个子项目；
- `sortedBy { it.name }` 保证注册顺序稳定（`listFiles()` 本身顺序不保证）；
- 项目路径为 `:<目录名>`（`apps/whirlwind` → `:whirlwind`，`packages/common` → `:common`）。

因此 **新增应用/库无需修改本文件**，放好目录与 `build.gradle.kts` 即可。

> 说明：Gradle 默认要求项目路径与目录结构一致，这里用
> `project(":...").projectDir = dir` 把路径与真实目录解耦。若希望路径体现层级
> （`apps/whirlwind` → `:apps:whirlwind`），改成
> `include("apps:${dir.name}")` / `project(":apps:${dir.name}")` 即可。
>
> Gradle 9 默认会对 `include` 的项目名做校验；目录名使用小写、避免特殊字符可减少意外。

---

## 2. 根 build.gradle.kts —— 共享配置

```kotlin
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
```

职责与约定：

- **插件版本来自版本目录**：`alias(libs.plugins.kotlin.jvm) apply false` 只声明、不应用。
  当前应用都是 Java；将来某个应用要写 Kotlin，只需在它的脚本里 `plugins { alias(libs.plugins.kotlin.jvm) }`，
  无需再写版本号。
- **`group` / `version` 由各应用自行声明**：便于各应用独立命名与版本化，根项目不再统一设置。
- **仓库统一**：`mavenCentral()` 在根声明，各应用不必再写 `repositories {}`。
- **测试运行器统一**：`useJUnitPlatform()` 对所有子项目的 `Test` 任务生效。
- **测试依赖由各应用自行声明**：JUnit 依赖写在应用的 `dependencies {}` 里，通过版本目录
  引用版本（见第 3、4 节）。

---

## 3. 各应用的 build.gradle.kts —— 应用自身配置

以 `apps/whirlwind/build.gradle.kts` 为例：

```kotlin
plugins {
    application                 // 生成 run / distZip 等任务
}

group = "com.center"
version = "1.0.0"

dependencies {
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)

    // 应用自身依赖
    implementation(libs.guava)
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

application {
    mainClass = "com.center.whirlwind.App"
}
```

各应用脚本声明**自己的** `group` / `version`、测试依赖，以及独有的插件、工具链、业务依赖、入口类。
仓库 / 测试运行器从根继承，不要重复。

### 3.1 源码布局

应用使用 **Gradle 默认源码布局**，无需任何额外配置。`whirlwind` 的实际结构：

```
apps/whirlwind/
└── src/
    ├── main/
    │   ├── java/com/center/whirlwind/App.java
    │   └── resources/
    └── test/
        ├── java/com/center/lowpressure/FriendTest.java
        └── resources/
```

| 用途 | 默认位置 |
| --- | --- |
| 主源码 | `src/main/java` |
| 主资源 | `src/main/resources` |
| 测试源码 | `src/test/java` |
| 测试资源 | `src/test/resources` |

#### 可选：使用自定义布局

如果不想用默认布局（例如希望主源码直接放在 `src/`、测试放在 `test/`），在应用脚本里用
`sourceSets` 显式覆盖即可：

```kotlin
sourceSets {
    main {
        java.setSrcDirs(listOf("src"))
        resources.setSrcDirs(listOf("src/resources"))
    }
    test {
        java.setSrcDirs(listOf("test"))
        resources.setSrcDirs(listOf("test/resources"))
    }
}
```

两种布局可以在不同应用中共存；只要源码目录与 `sourceSets` 声明一致即可。

### 3.2 入口类（mainClass）

`application` 插件的 `mainClass` 必须是**完整限定类名**，且与源码里的 `package` 一致：

```kotlin
application {
    mainClass = "com.center.whirlwind.App"   // 对应 src/com/center/whirlwind/App.java
}
```

常见错误：`mainClass` 写成项目名（如 `jestar.whirlwind.App`）而源码包名是
`com.center.whirlwind`，运行时会报 `Could not find or load main class`。

### 3.3 依赖另一个子项目 / 公共库

子项目之间用 **项目依赖（project dependency）** 互相引用，而不是复制代码。

**直接从另一个子项目导入**（少用）：

```kotlin
dependencies {
    implementation(project(":whirlwind"))
}
```

**推荐：把公共逻辑抽到 `packages/` 下的库模块**，让各应用依赖它。

1. 新建 `packages/common/`，用 `java-library` 插件：

```kotlin
// packages/common/build.gradle.kts
plugins {
    `java-library`
}

group = "com.center"
version = "1.0.0"

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
}
```

2. 公共类放进去，例如 `packages/common/src/main/java/com/center/common/Friend.java`：

```java
package com.center.common;

public class Friend { /* ... */ }
```

3. 应用声明项目依赖并在代码里 `import`：

```kotlin
// apps/island/build.gradle.kts
dependencies {
    implementation(project(":common"))
}
```

```java
import com.center.common.Friend;
```

**`api` 还是 `implementation`：**

- `implementation(project(":common"))`：只在本模块**内部**使用，不暴露给依赖本模块的下游；
- `api(project(":common"))`：如果公共库的类型出现在本模块的**公开 API**（方法签名/返回值）里，
  用 `api`，这样下游也能在编译期看到这些类型。

> 为什么不直接依赖 `:whirlwind`？因为 `:whirlwind` 是**应用**（`application` 插件 + `main`），
> 把它当库依赖语义混乱。公共代码应放在 `java-library` 模块（`packages/`）里。

---

## 4. 依赖版本目录

`gradle/libs.versions.toml` 集中管理所有依赖与插件的版本，脚本里通过 `libs.*` 引用：

```toml
[versions]
guava = "33.5.0-jre"
junit = "6.0.1"
kotlin = "2.0.21"

[libraries]
guava = { module = "com.google.guava:guava", version.ref = "guava" }
junit-jupiter = { module = "org.junit.jupiter:junit-jupiter", version.ref = "junit" }
junit-platform-launcher = { module = "org.junit.platform:junit-platform-launcher", version.ref = "junit" }

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
```

用法：

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm)      // 插件，键 `kotlin-jvm` -> libs.plugins.kotlin.jvm
}

dependencies {
    implementation(libs.guava)                    // 库，键 `guava` -> libs.guava
    testImplementation(libs.junit.jupiter)        // 键 `junit-jupiter` -> libs.junit.jupiter
    testRuntimeOnly(libs.junit.platform.launcher) // 键 `junit-platform-launcher`
}
```

说明：`junit-jupiter` 与 `junit-platform-launcher` 共用 `junit` 版本（JUnit 6 起平台与
Jupiter 同版本）。新增依赖或插件时先在此登记，避免版本散落在各应用脚本里。

---

## 5. gradle.properties

```properties
org.gradle.configuration-cache=true
```

启用了**配置缓存**：第二次起构建会复用配置阶段的结果，明显加速。注意修改构建脚本、
`settings.gradle.kts`、`gradle.properties` 或版本目录都会使缓存失效并重新计算。

---

## 6. 工具链（Java Toolchain）

- 每个应用用 `java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }`
  声明所需 JDK 版本，而不是依赖本机 `JAVA_HOME`。
- `settings.gradle.kts` 里的 `foojay-resolver-convention` 插件会在本机缺少对应 JDK 时
  自动下载，保证在不同机器上构建一致。

---

## 约定速查

| 项 | 约定 |
| --- | --- |
| 应用位置 | `apps/<name>/`，必须含 `build.gradle.kts` |
| 库位置 | `packages/<name>/`，用 `java-library` 插件 |
| 项目路径 | `:<name>` |
| `group` | 各应用自行声明（示例 `com.center`） |
| `version` | 各应用自行声明（示例 `1.0.0`） |
| 仓库 | `mavenCentral()`（根统一设置） |
| 测试运行器 | JUnit Platform（根统一设置） |
| 依赖 / 插件版本 | `gradle/libs.versions.toml`（应用里通过 `libs.*` / `alias(libs.plugins.*)` 引用） |
| 测试依赖 | 各应用自行声明（通过 `libs.*` 引用版本） |
| JDK | 21（各应用声明，foojay 自动补齐） |
