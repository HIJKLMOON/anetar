# 新增一个应用

`apps/` 下的应用会被 `settings.gradle.kts` 自动发现，因此新增应用只需三步：
**建目录 → 写 `build.gradle.kts` → 写源码**。无需修改 `settings.gradle.kts` 或根构建脚本。

以下示例新增一个名为 `norwester` 的应用。

---

## 1. 创建目录

```sh
mkdir -p apps/norwester
```

## 2. 创建 `apps/norwester/build.gradle.kts`

### 方式 A：使用 Gradle 默认源码布局（推荐新手）

源码放 `src/main/java/`、测试放 `src/test/java/`：

```kotlin
plugins {
    application
}

group = "com.center"
version = "1.0.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)

    implementation(libs.guava)          // 业务依赖按需
}

application {
    mainClass = "com.center.norwester.App"
}
```

### 方式 B：使用自定义扁平布局（可选）

源码放 `src/`、测试放 `test/`：

```kotlin
plugins {
    application
}

group = "com.center"
version = "1.0.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

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

dependencies {
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)

    implementation(libs.guava)          // 业务依赖按需
}

application {
    mainClass = "com.center.norwester.App"
}
```

> 注意：`repositories` / `useJUnitPlatform()` 由根 `build.gradle.kts` 统一提供，**不要**重复；
> `group` / `version` 与测试依赖需要每个应用自己声明。
>
> 若要用公共库（`packages/` 下的模块），在 `dependencies` 里加一行
> `implementation(project(":common"))` 即可 —— 见 [build-configuration.md](./build-configuration.md) 第 3.3 节。

## 3. 创建源码

方式 A（默认布局）：

```
apps/norwester/src/main/java/com/center/norwester/App.java
```

方式 B（自定义布局）：

```
apps/norwester/src/com/center/norwester/App.java
```

内容：

```java
package com.center.norwester;

public class App {
    public static void main(String[] args) {
        System.out.println("norwester");
    }
}
```

> `package` 必须与 `mainClass` 一致，也要与源码目录的层级一致。

（可选）加上测试，方式 A 放 `src/test/java/...`，方式 B 放 `test/...`：

```java
package com.center.norwester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class AppTest {
    @Test
    void smoke() {
        assertEquals(1, 1);
    }
}
```

## 4. 运行与验证

```sh
./gradlew projects            # 应能看到新增的 :norwester
./gradlew :norwester:run      # 运行
./gradlew :norwester:build    # 构建 + 测试
```

---

## 如果要写 Kotlin 应用

根项目已在版本目录里声明 Kotlin 插件（`apply false`），在应用脚本里用 `alias` 应用即可，无需写版本：

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm)
    application
}

group = "com.center"
version = "1.0.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)
}

application {
    mainClass = "com.center.norwester.AppKt"   // Kotlin 顶层 main 函数所在文件生成的类名
}
```

此时默认源码目录为 `src/main/kotlin`。

---

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `./gradlew projects` 里找不到新应用 | `apps/<name>/` 下缺少 `build.gradle.kts` |
| `Could not find or load main class ...` | `mainClass` 与源码 `package` 不一致 |
| `compileJava` 编译不到源码 | 源码目录与 `sourceSets` 声明不一致（默认布局/自定义布局混用） |
| 运行测试时提示没有测试 | 测试类缺少 `@Test` 注解，或不在配置的测试源码目录下 |
| 改了脚本但没生效 | 配置缓存失效后会重算；必要时 `./gradlew --refresh-dependencies` |
