# fewbie 前端框架设计决议

> 状态：设计决议（2026-09-24）
> 本文档取代 `/Users/worldzhy/src/newbie/.agent/documents/newbie-framework-split-plan.md` 中第六章「@devbie/fewbie-core 设计」的旧方案（旧方案拟照抄 @devbie/newbie 的重 npm 包模式，已废弃；该后端文档已于 2026-09-24 同步修订）。

## 一、背景与触发条件

讨论 fewbie 的两个触发因素：

1. **即将迎来新的前端项目**——多消费者即将出现，框架抽取有了真实依据（此前只有 nightwatch-frontend 一个项目，抽包属于过早抽象）。
2. **v0.dev 无缝集成诉求**——希望 fewbie 可以直接被 Vercel 的 v0.dev 读取，从而无缝地在 v0 上设计开发前端。

## 二、核心判断：shadcn 哲学在 AI 编码时代占优

v0.dev 的「母语」是 **Next.js App Router + Tailwind + shadcn/ui (Radix) + CSS 变量**。这不是 v0 的偶然偏好，而是由 LLM 工作机制决定的普遍规律，在所有主流 AI 编码工具上均成立：

1. **LLM 走最短上下文路径**——优先调用训练数据里海量存在的模式（Tailwind 类名、shadcn 组件 API、Next.js App Router）；自定义 Factory / Provider 链在训练数据里几乎不存在，AI 必须读文档或 node_modules 才能理解，成本高、出错率高。
2. **代码即文档（AI 可读性 = AI 可生成性）**——shadcn 把组件源码写进项目，AI 直接读得到 props/variants/style hooks；npm 包组件对 AI 是黑箱。
3. **粘性边界 = 复制边界 = AI 生成边界**——`npx shadcn add button` 同时是人工修改边界、AI 读取边界、AI 生成边界，三者重合，零认知摩擦。
4. **代码所有权**——shadcn 式组件在项目里，AI 改一次就一直有效；npm 包升级后 AI 之前生成的代码可能 API 失效。

适用工具（不限于 v0）：v0.dev、Bolt.new、Lovable 默认输出 Tailwind + shadcn/ui；Cursor / Trae / Windsurf 等读项目源码的工具在 shadcn 源码在项目内时生成质量最高；跨工具对话（Claude / GPT）粘代码流转时 shadcn 通畅、npm 包断裂。

**结论：fewbie 的整体设计统一在 shadcn 哲学下——标准约定 + 自包含源码 = AI 最短上下文路径。**

## 三、决议 1：UI 库从 MUI 转向 shadcn/ui

### 现状

nightwatch-frontend 当前依赖 MUI 生态：

```
@mui/material: ^5.14.5
@mui/icons-material: ^5.14.3
@emotion/react + @emotion/styled   # MUI 样式引擎
@mui/x-data-grid / @mui/x-date-pickers
```

无 shadcn/ui、无 Radix、无 `components.json`。design token 以 JS theme 对象（`src/constants/theme.ts`）形式存在。

### 冲突

v0 默认输出 shadcn/ui 代码——粘进 MUI 项目会缺 `components/ui/*`、缺 `cn()` util、缺 Radix 依赖、缺 CSS 变量 token，无法无缝。

### 决议

**fewbie 采用 Tailwind CSS + shadcn/ui (Radix) + CSS 变量 token 体系，与 v0 默认完全对齐。**

- design token 从 JS theme 对象迁移到 CSS 变量（`:root { --primary: ... }`）+ Tailwind config
- 组件形态为 shadcn 式源码复制（CLI `add` 写入项目），不是 npm 依赖
- 影响：nightwatch-frontend 现有 MUI 页面（DataGrid、Tabs、Dialog、PageHeader 等）需逐步迁移到 shadcn/ui（迁移路径见第七章，为待定项）
- 新项目直接基于 shadcn/ui 创建，开箱享受 v0 无缝

## 四、决议 2：框架形态为 shadcn 式 CLI，不发 @devbie/fewbie-core 运行时 npm 包

fewbie 与 @devbie/newbie **根本分野**，不照抄后端的重 npm 包模式：

| 维度             | @devbie/newbie（后端）        | fewbie（前端）                               |
| ---------------- | ----------------------------- | -------------------------------------------- |
| 形态             | npm 包，重运行时              | CLI + 模板仓库，**不发运行时 npm 包**        |
| 启动             | `NewbieFactory.create()` 封装 | 不封装——贴近 vanilla Next.js                 |
| 组件             | 在包里                        | CLI `add` 把源码写入项目（shadcn 模式）      |
| design token     | —                             | CSS 变量 + Tailwind config                   |
| SDK / API 客户端 | —                             | 可选 `add`，opt-in                           |
| 升级方式         | `npm update @devbie/newbie`   | `fewbie update` → diff PR，用户 review merge |

分野原因：后端生态标准是 NestFactory（生态约定，AI 也认），重运行时封装符合 NestJS 惯例；前端生态标准是 Next.js + Tailwind + shadcn（AI 母语），任何自定义 Factory/Provider 链都会增加 AI 理解成本。

## 五、决议 3：非 UI 功能三类分治

原则：**「能复制的就复制，能调用工具的就调用，不发 npm 运行时包」。**

### Class A — shadcn 式复制源码（运行时 util）

`fewbie add <name>` 把 util 源码写入项目，与 UI 组件同一种模式。

| 命令                    | 写入位置                                        | 内容                                                                                                                              |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `fewbie add api-client` | `src/api/client.ts`                             | axios 实例 + access token 存储 + refresh token 轮换 + 401 拦截重试 + 跨 tab 同步（即当前 `src/api/fetch.ts` 约 200 行逻辑的骨架） |
| `fewbie add auth`       | `src/lib/auth.ts`                               | login/logout util + route guard + 主动刷新调度器（proactive refresh）                                                             |
| `fewbie add theme`      | `src/styles/globals.css` + `tailwind.config.ts` | CSS 变量 token + Tailwind config                                                                                                  |

采用复制而非 npm 包的理由：

1. **配置项项目特定**——storage key、refresh endpoint、token 字段名、登录跳转路径每个项目不同，源码在项目里改一行比配 options 对象方便。
2. **AI 调试热点**——auth/token bug 高频，AI 直接读源码定位（401 死循环、token 不更新等），比读 npm 包黑箱快一个数量级。
3. **逻辑量小**——约 200 行运行时 util，复制成本远低于维护 npm 包版本 / peerDeps / 文档的成本。
4. **v0 生成友好**——v0 生成受保护页面时能直接读到 `src/lib/auth.ts` 的 API 并按其调用方式生成代码。

### Class B — CLI 工具（开发期运行，不进 bundle）

| 命令                     | 调用对象                                                                                                        | 产物                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `fewbie init`            | 模板仓库 + design token                                                                                         | Next.js + Tailwind + shadcn 骨架      |
| `fewbie add <component>` | 组件模板库                                                                                                      | `components/fewbie/*.tsx`             |
| `fewbie gen api`         | `apits-gen`（原名 open-api-typescript-request-generator，2026-09-24 定名；作为 devDependency 引入，**不重写**） | `src/api/_gen/*.ts`（生成物归项目）   |
| `fewbie doctor`          | 项目扫描                                                                                                        | v0 可读性检测、token 一致性、依赖检查 |
| `fewbie update`          | git diff                                                                                                        | 组件 / token 升级 diff PR             |

关键决策：**`apits-gen` 保持独立 npm 包**，fewbie CLI 仅作 thin wrapper（`fewbie gen api`）。理由：

- 它已是独立项目（包名 `apits-gen`，unscoped，不属 `@devbie` scope；bin 命令 `apits`、配置文件 `apits.config.ts`），重写是浪费。注意：本地仓库目录 `/Users/worldzhy/src/open-api-typescript-request-generator` 当前不存在（2026-09-24 核实，`~/src/apits-generator.code-workspace` 对该目录的引用悬空），仓库重新就位及目录改名（拟改为 `apits-gen`）待执行。
- 生成器是开发期工具不是运行时，工具就该是 CLI。
- 生成物归项目（`src/api/_gen/`），符合 shadcn 哲学——用户拥有源码。

### Class C — UI 组件（shadcn 式复制源码）

| 命令                                 | 内容                                               |
| ------------------------------------ | -------------------------------------------------- |
| `fewbie add login-form`              | 登录表单 UI（用户名/密码字段、提交按钮、错误提示） |
| `fewbie add page-header`             | 标准页头                                           |
| `fewbie add data-table`              | 数据表格                                           |
| `fewbie add settings-required-state` | 设置缺失状态                                       |

`login-form`（UI）与 `auth`（逻辑）分开 `add` 但配合使用：UI 组件 import `auth` 的 login util，逻辑解耦。支持 `fewbie add auth --with-login-form` 一并安装。

### 汇总

| 功能                      | 形态                                   | 命令                    | 升级方式     |
| ------------------------- | -------------------------------------- | ----------------------- | ------------ |
| login UI                  | shadcn 式复制                          | `fewbie add login-form` | diff PR      |
| refreshToken / token 拦截 | shadcn 式复制                          | `fewbie add api-client` | diff PR      |
| auth util / route guard   | shadcn 式复制                          | `fewbie add auth`       | diff PR      |
| design token              | shadcn 式复制                          | `fewbie add theme`      | diff PR      |
| apits-gen                 | CLI 工具（独立 npm 包 + thin wrapper） | `fewbie gen api`        | `npm update` |
| API 生成物 `_gen/`        | 项目源码                               | （由 gen api 生成）     | 重新生成     |

## 六、fewbie 体系全景

```
fewbie CLI（@devbie/fewbie-cli，全局 npm 包，仅工具层）
├── fewbie init              从 fewbie 模板仓库创建项目（Next.js + Tailwind + shadcn）
├── fewbie add <name>        复制组件/util 源码到项目（shadcn 模式）
│   ├── UI:    login-form / page-header / data-table / settings-required-state / ...
│   └── 逻辑:  api-client / auth / theme / web-monitor-sdk（opt-in）
├── fewbie gen api           thin wrapper → apits-gen（OpenAPI → TS 请求代码生成器）
├── fewbie doctor            v0 可读性 / token 一致性 / 依赖检查
└── fewbie update            组件/token 升级 → diff PR

fewbie 模板仓库（git 模板）
└── 前端项目骨架（业务侧 Next.js 项目结构），通过 fewbie update → diff PR 同步

运行时：无 @devbie/fewbie-core npm 包——所有运行时代码以源码形式归项目所有
```

web-monitor SDK（自动 PV/错误上报）采用混合分发（2026-09-24 决议）：npm 包 `@devbie/web-monitor-sdk`（独立版本）+ `fewbie add web-monitor-sdk` thin wrapper（脚手架初始化样板 + 在 package.json 加入 `@devbie/web-monitor-sdk` 依赖）。旧名 `@inceptionpad/frontend-monitor-web-sdk`、`@doctorwork/web-report-sdk` 已弃用/被取代。SDK 的 endpoint / 凭证 / 数据格式依赖 UI 层次重构 Phase 1 的 Application/Agent 模型落地后才能定稿。

**应用心跳义务（2026-09-25 新增）**：`@devbie/web-monitor-sdk` 是 newbie web-monitor 服务的配套 SDK，分**服务端组件**（在线判定信号源）与**浏览器组件**（只上报数据，不发心跳）——契约真源见 nightwatch `application-creation-flow-design.md` 7.3/9.11。fewbie 侧义务：

1. **fewbie 模板**：内置 `instrumentation.ts`，`register()` 中 `NEXT_RUNTIME === 'nodejs'` 时调用 `@devbie/nightwatch-heartbeat-sdk` 启动心跳（SDK 内部 `setInterval(30s).unref()` + global symbol 幂等防 dev HMR 重复启动）——模板创建的应用部署即在线可见，零配置。
2. **`fewbie add web-monitor-sdk` thin wrapper**：为非模板项目脚手架同样的 `instrumentation.ts` 接线（项目已有该文件时提示合并，不覆盖）。
3. **边界**：心跳证明进程存活与事件循环可响应，不代表外部可达性；Serverless/Edge 部署无常驻进程，不支持（目标部署为常驻 Node 容器）。

## 七、待定项与影响

1. **nightwatch-frontend MUI → shadcn/ui 迁移路径**——现有大量 MUI 页面与共享组件（`src/components/`），迁移工作量大，需单独制定渐进式迁移方案（建议结合 UI 层次重构的路由迁移同步推进，新路由直接用 shadcn，旧路由逐步替换）。
2. **fewbie 仓库结构**——工作决议：fewbie monorepo（`@devbie/fewbie-cli` + 组件/util registry + `templates/basic`），registry 源码随 CLI 包分发（v1 最简）。本地 `~/src/fewbie` 已于 2026-09-24 占位初始化（仅含 README），目录结构待开建时最终确认。
3. **实施时机**——fewbie 不阻塞后端 @devbie/newbie 抽取；新项目启动在即，建议优先完成 `fewbie init` + 基础 `add` 能力（api-client / auth / theme / login-form），以新项目作为首个真实落地验证。
4. ~~`newbie-core-packaging-plan.md` Phase 5 需按本决议重写~~——已完成（2026-09-24）：后端文档已重命名为 `newbie-framework-split-plan.md`，第六章与 Phase 5/6 均已按本决议同步。

## 八、决策记录

| #   | 决策                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 日期       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | fewbie UI 库从 MUI 转向 shadcn/ui，对齐 v0 默认                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-09-24 |
| 2   | fewbie 不发 @devbie/fewbie-core 运行时 npm 包，采用 shadcn 式 CLI + 模板仓库                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-09-24 |
| 3   | 非 UI 功能三类分治：运行时 util 复制源码 / 开发期工具走 CLI / UI 组件复制源码；`apits-gen` 保持独立 npm 包                                                                                                                                                                                                                                                                                                                                                                          | 2026-09-24 |
| 4   | 命名决议：生成器包 open-api-typescript-request-generator → apits-gen（bin/配置零改动）                                                                                                                                                                                                                                                                                                                                                                                              | 2026-09-24 |
| 5   | 后端命名联动（详见后端拆分计划）：管理服务 newbie-hub → **module-hub**；「microservices」概念定名 **module**。前端面板标签 "Modules"、路由段 `/modules`                                                                                                                                                                                                                                                                                                                             | 2026-09-24 |
| 6   | 前后端哲学统一：后端 module 分发同样采用「monorepo registry（`newbie-modules`）+ CLI 复制源码 + diff PR 升级」，与 fewbie 的 shadcn 模式对称（`newbie add` ↔ `fewbie add`），放弃一 module 一 git 子模块                                                                                                                                                                                                                                                                            | 2026-09-24 |
| 7   | npm scope 统一为 `@devbie`（org 名 "devbie" — "dev" = development tools，"-bie" = brand signature from newbie/fewbie，含义为 "beginner-friendly development tools family"）。包名：`@devbie/newbie`、`@devbie/newbie-cli`、`@devbie/fewbie-cli`。注：`apits-gen` 为 unscoped 独立包，不属 `@devbie` scope（bin 命令 `apits`、配置文件 `apits.config.ts`）。理由：`@newbie`、`@newbiejs`、`@nightwatch` 在 npm 上均不可用；`@devbie` 将所有框架包统一在同一 scope 下，保持品牌一致性 | 2026-09-24 |
| 8   | **apits 包名决议**：生成器包名为 `apits-gen`（unscoped，**不属 `@devbie` scope**），bin 命令保持 `apits`，配置文件保持 `apits.config.ts`。取代此前文档中将其归入 @devbie scope 的写法。理由：apits-gen 作为通用 OpenAPI → TS 代码生成器，独立于 devbie 框架族存在，unscoped 发布更符合其独立项目定位                                                                                                                                                                                | 2026-09-24 |
| 9   | **web-monitor SDK 混合分发**：npm 包 `@devbie/web-monitor-sdk`（独立版本）+ `fewbie add web-monitor-sdk` thin wrapper（脚手架初始化样板 + 在 package.json 加入 `@devbie/web-monitor-sdk` 依赖）。旧名 `@inceptionpad/frontend-monitor-web-sdk`、`@doctorwork/web-report-sdk` 已弃用/被取代。理由：npm 包覆盖非 fewbie 项目的接入便利性，fewbie thin wrapper 保留 shadcn 哲学的 AI 编码友好性，两者服务不同目标不冲突                                                                | 2026-09-24 |
| 10  | **后端 module 重命名 `frontend-monitor` → `web-monitor`**：影响 module 目录 `src/microservices/frontend-monitor/` → `src/microservices/web-monitor/`（Phase 3 后 `src/modules/web-monitor/`）、settings/config 注册 key、前端路由 `/frontend-monitor/` → `/web-monitor/`、sidebar 标签 "Frontend Monitor" → "Web Monitor"。不变项：Agent 类型枚举 `WEB_MONITOR`（已正确）、`SERVER_MONITOR`；"frontend" 作为通用概念（前端应用、前端框架）不受影响；`fewbie`、`newbie` 框架名不变   | 2026-09-24 |
| 11  | 包名去除 `-core` 后缀：`@devbie/newbie`（原 `newbie-core`）。理由：`-core` 后缀多余——无兄弟包（不像 NestJS 的 `@nestjs/common`/`@nestjs/platform-express` 需要区分），缩短 import 路径，框架名 = 包名                                                                                                                                                                                                                                                                               | 2026-09-24 |
