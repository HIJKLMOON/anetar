# jestar 构建文档

`jestar` 是一个基于 **Gradle + Kotlin DSL** 的多项目构建：`apps/` 下管理多个应用，
`packages/` 下管理可被应用复用的公共库。本目录记录构建的配置方式与约定。

## 环境要求

| 项目 | 版本 |
| --- | --- |
| JDK | 21（通过工具链声明，缺失时由 foojay-resolver 自动下载） |
| Gradle | 9.7.1（使用仓库内的 Wrapper，无需本机安装） |
| 构建脚本语言 | Kotlin DSL（`.kts`） |
| Kotlin 插件（可选） | 2.0.21 |

> 构建脚本是 Kotlin DSL，但这**不代表**项目就是 Kotlin 语言项目。当前的应用都是
> Java 应用；Kotlin 插件只在根项目声明版本、不默认应用。

## 目录结构

```
jestar/
├── apps/                         # 所有应用，一个目录 = 一个子项目
│   ├── island/                   # :island（独立 git 仓库 / submodule）
│   │   ├── build.gradle.kts
│   │   └── src/
│   │       ├── main/java/com/center/island/App.java
│   │       └── test/java/com/center/island/AppTest.java
│   └── whirlwind/                # :whirlwind（独立 git 仓库 / submodule）
│       ├── build.gradle.kts
│       └── src/
│           ├── main/java/com/center/whirlwind/App.java
│           └── test/java/com/center/lowpressure/FriendTest.java
├── packages/                     # 可复用库，一个目录 = 一个子项目
│   └── common/                   # :common（java-library）
│       ├── build.gradle.kts
│       └── src/main/java/com/center/common/Friend.java
├── gradle/
│   ├── libs.versions.toml        # 版本目录：集中管理依赖版本
│   └── wrapper/                  # Gradle Wrapper
├── build.gradle.kts              # 根构建脚本：共享配置
├── settings.gradle.kts           # 自动发现 apps/ 与 packages/ 下的子项目
├── gradle.properties             # Gradle 全局属性
└── gradlew / gradlew.bat         # Wrapper 启动脚本
```

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [build-configuration.md](./build-configuration.md) | 各层构建脚本的职责、自动发现机制、源码布局、版本目录、工具链 |
| [adding-an-app.md](./adding-an-app.md) | 如何新增一个应用（含可直接复制的模板） |

## 常用命令

所有命令在 `jestar/` 目录下执行。

```sh
./gradlew projects              # 列出所有子项目
./gradlew build                 # 构建全部应用
./gradlew :island:run           # 运行指定应用
./gradlew :island:test          # 运行指定应用的测试
./gradlew :whirlwind:run
./gradlew :whirlwind:test
```

首次使用或依赖变更后可用 `./gradlew --refresh-dependencies` 强制刷新依赖。
