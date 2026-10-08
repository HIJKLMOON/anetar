/*
 * jestar 多项目构建入口。
 *
 * 自动注册两个分组下的模块（每个直接子目录只要含 build.gradle.kts 就会被注册）：
 *   - apps/      应用（可运行程序）  apps/island      -> :island
 *   - packages/  可复用库           packages/common -> :common
 *
 * 项目路径即目录名。新增应用/库时无需修改本文件。
 */

plugins {
    // Apply the foojay-resolver plugin to allow automatic download of JDKs
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "jestar"

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
