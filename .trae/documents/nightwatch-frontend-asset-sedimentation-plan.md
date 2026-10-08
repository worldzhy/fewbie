# nightwatch-frontend 资产沉淀到 fewbie 框架 — 实施计划

> 状态：**已执行完毕**（2026-10-08 拍板：D1 首轮只做 app-shell + apits 范式；M3 两个 A 档小项当日经用户确认回补）
> 执行记录：M1 app-shell（`1f69e3e`）、M2 query-client + 范式文档（`bb33d35`）、M4 登记与收尾（doctor 核对发现 page-header/settings-required-state 存在设计对齐增量，已回灌 registry，`afeaa65`；登记落盘 `f8ef789`）、M3 password-checklist（`68f9b72`）+ sse-stream（`7939da9`）。验收全部通过：每个 item 独立 add 入临时项目（React 19.2 / Next 16.3.6 模板）build 全绿；sse-stream 额外通过容器内临时 HTTP server 做了运行时流式验证（keepalive/双换行风格/跨 chunk 分帧/多字节截断重组、SseStreamError 带 status、abort 及时停止，证据在容器 /tmp 不入库）；`grep nightwatch|copilot` 各 item 零命中。唯一留观项：M1 浏览器手工抽检（本环境无浏览器工具）——折叠/展开/flyout 交互为宿主项目生产验证过的逐字迁移，建议下个真实消费项目接入时顺带目检一次。
> 盘点基线：fewbie @ `d0b173d`（dev）、nightwatch-frontend @ `bea57b8`（dev），盘点日期 2026-10-08。
> 事实优先级：本计划所有规模/耦合判定以两仓源码为准（文件行数、import、package.json），不以记忆或讨论印象为准。
> 归属规则：代码文件一律英文（遵循跨仓硬性规则）；本文档位于 `.trae/`，用中文。

## 1. 背景与目标

nightwatch-frontend（下称 nw）是 fewbie 体系的第一个复杂宿主，但它早于 fewbie 存在、手工建成，**不是 fewbie 项目**（仓内无 fewbie 标记，`fewbie init` 对非空目录直接拒绝）。2026-09 至 10 月，nw 完成了 Next.js App Router 迁移、MUI→shadcn 单栈收敛、设计系统基线对齐（圆角/排版/间距/侧栏 240↔64 折叠），积累了一批**超出 basic 模板现状、且对所有 dashboard 型业务项目通用**的资产。

fewbie registry 当前仅 8 个 item（api-client、auth、data-table、login-form、page-header、settings-required-state、theme、web-monitor-sdk），模板只有 19 个文件的最小启动器：无应用壳层、无服务端状态范式、无流式传输 util。

**目标**：把 nw 中已被真实项目验证、通用性成立的资产，按 fewbie 既有机制（shadcn registry 兼容格式 + CLI 复制源码）沉淀为 registry item，让后续项目 `fewbie add` 即得；沉淀方向是 **nw → fewbie 单向抽取**，本计划不含让 nw 反向消费这些 item（见第 5 节 Non-Goals）。

## 2. 收录规则（继承，不重开决策）

遵循 `fewbie-framework-design.md` 决策 12：

1. 标准 shadcn ui 原语（button/dialog/select 等）**不进 registry**，随模板官方 `shadcn init` 产物存在，升级走官方 CLI；
2. registry 只承载**业务组件**（block/component）与**逻辑 util**（lib），格式兼容 shadcn registry 协议，`fewbie add` 与 `npx shadcn add` 双端可装；
3. item 机制现状（取证 `packages/fewbie-cli/src/commands/add.ts`）：
   - 多文件 item 有先例（theme 含 2 文件）；
   - `dependencies` 声明的 npm 包缺失时自动 `npm install`；
   - 目标文件已存在时整体拒绝（除非 `--force`），冲突前置检测、不会半写；
   - `registryDependencies` 自动拉取传递依赖；
   - 安装后仅能通过 `postInstall` 文本给集成提示，**无代码改写能力**——凡需改 layout/Provider 树的，必须由开发者按提示手工接线。

## 3. 待拍板决策点

| # | 决策 | 选项 | 影响面 | 当前推荐 |
|---|---|---|---|---|
| D1 | 本轮沉淀范围 | A 档全做（4 项）/ **只做 app-shell + apits 范式** / 仅登记不实施 | 只做两件约 1 人日；全做约 1.5–2 人日 | 只做两件（无争议通用资产，互相配套） |
| D2 | 是否确立「newbie 后端模块 ↔ fewbie 前端 companion item」配对与跟版约定 | 现在定 / 等 copilot phase 2 收尾连同 copilot-dock 一起定 | 两仓目前无任何版本联动机制；首对 companion 会立先例 | 等 copilot phase 2 后单独立项，本轮只登记 |
| D3 | nw 侧技术债（react-toastify→sonner 动 37 文件、手写 theme store→next-themes、React 18→19） | 记债专门会话处理 / 搭本次沉淀顺带做 | 顺带做会让框架沉淀与宿主迁移混在一个里程碑，回归面失控 | 记债，不搭车 |

## 4. 候选资产分级（盘点结论）

### A 档：通用性成立，建议沉淀

#### A1. app-shell（registry:block）

- **来源**：`src/components/sidebar-chrome.tsx`（280 行，8 个导出：`useSidebarCollapsed`、`SidebarNavLink`、`SidebarBackButton`、`SidebarCollapseToggle`、`CollapsedGroupDivider`、`CollapsedFlyoutMenu`、`FlyoutLink`、`FlyoutSectionLabel`）。
- **成熟度证据**：10-07 刚完成设计基线对齐（240/64 折叠、`bg-accent text-primary font-semibold` 选中态、`min-h-10`、tooltip flyout）；两套真实壳层消费——`src/app/(dashboard)/projects/[projectId]/layout.tsx`（535 行，23+ 处 SidebarNavLink）与 `src/app/(dashboard)/jdy/[accountSetId]/layout.tsx`（105 行）。
- **耦合审计（已取证，去耦成本低）**：
  - localStorage key 硬编码 `"nightwatch:sidebar-collapsed"` → 抽为 item 入参/常量前缀，postInstall 提示改名；
  - 唯一外部样式依赖 `cn`（模板 package.json 已含 `cn@^0.4.0`，对齐，零新增依赖）；ui 原语仅 popover/tooltip（消费项目 shadcn init 提供，不打包）；
  - 导航项不在组件内——两个消费 layout 各自以 JSX 声明 nav，证明原语层天然无业务耦合；
  - 使用 `useSyncExternalStore`（React 18/19 均支持，无版本障碍）。
- **item 形态**：`registry/app-shell/`，文件 `src/components/app-shell/sidebar-chrome.tsx`（逐字迁移 + key 前缀参数化）；附一个使用范例文件（折叠侧栏 + nav 配置数组的最小 app shell 骨架，作为 block 的第二文件）；`postInstall` 说明 storage key 改名、nav 配置项由项目自填。
- **不沉淀** nw 的 dashboard 顶层 layout（291 行，含用户鉴权跳转、ADMIN 角色判断、NightWatch 标题、react-toastify、登出 mutation——业务重耦合，只作范例参考不入 registry）。

#### A2. apits + react-query 集成范式（registry:lib）

- **缺口事实**：fewbie 有 `gen api` 命令但 registry 无消费范式；nw 有 **89 个文件**用 `@tanstack/react-query` 包 apits 生成客户端。
- **已踩平的坑（项目记忆 4.4）**：apits 返回 `ApiResponse<T> = [data?, res?]`，`noUncheckedIndexedAccess` 下解构必须空值守卫（`[data]` + `data ?? []`）；QueryClient 单例与 Provider 接线；queryKey 命名约定。
- **item 形态**：`registry/query-client/`，`src/lib/query-client.ts`（单例 + 推荐默认值）+ `src/components/query-provider.tsx`；dependencies 声明 `@tanstack/react-query@^5`；`postInstall` 指示在 root layout 包 Provider，并给一段 apits hook 范式（解构守卫 + queryKey 层级约定），范式文本同时追加到 `fewbie-framework-design.md` 的 gen api 章节。
- **待拍子项**：QueryClientProvider 是否未来提升进 basic 模板默认内置（默认内置则新项目零配置，但给不用 react-query 的项目强加依赖）——建议 v1 保持可选 item，模板不动。

#### A3. password-checklist（registry:block，小项）

- **来源**：`src/components/PasswordChecklist.tsx`（42 行），实时校验且规则与 newbie account 模块后端密码策略严格一致（跨仓硬约束：前端实时提示必须与后端规则一致）。
- **item 形态**：`src/components/password-checklist.tsx`，与既有 login-form item 生态配套（注册/改密场景）。实施时先审计其 import，ui 原语依赖不打包。
- **规则同步风险**：规则真源在 newbie account password.validator；item 描述中必须标注「规则跟随 newbie account 模块，后端策略变更时需手工同步」，不假装自动联动。

#### A4. sse-stream（registry:lib，小项）

- **来源**：`src/api/copilot/sse-stream.ts`（102 行）。通用内核：POST 发起 + ReadableStream 读取 SSE（EventSource 不支持 POST/自定义头的标准解）、abort、错误传播。
- **边界**：同目录 `chat-stream.ts`（83 行）含 copilot 事件语义，**不沉淀**；只抽传输内核，事件解析留给调用方。零外部依赖（fetch 原生）。

### B 档：companion block 方向成立，时机未到（本轮只登记）

| 候选 | 规模 | 配对后端模块 | 触发条件 |
|---|---|---|---|
| copilot-dock 全家桶 | 组件 933 行（CopilotDock/timeline/tool-card/snapshot-card/use-copilot-chat 等 7 文件）+ api/view-model 层 510 行（copilot.api/types/view-model/sse-stream/chat-stream） | copilot kernel（SSE 协议、blocks 协议） | **copilot monitoring phase 2 交付、blocks 协议冻结后**再抽；移动靶期沉淀等于反复返工。抽离时生成 API import 走 postInstall 占位，不打包业务 DTO |
| notification-bell 一套 | 536 行（NotificationBell 206、DetailSheet 139、notification-meta 143、SeverityBadge、RelativeTime） | notification-center capability（17 个通知 key、severity、receipt） | 不紧急；实施时随 D2 配对约定一起做，且 meta 映射（key→标题/分组）需确认是复制快照还是由后端声明下发 |

### C 档：nw 的债，禁止反向污染框架

- `react-toastify`（37 个文件使用，模板标准是 sonner）；
- 手写 `src/store/useThemeStore.ts`（模板标准是 next-themes，registry 已有 theme item）；
- React 18.3（模板 19.2）、旧 `src/api/fetch.ts` axios 封装与 apits 客户端并存；
- 处置：在 nw 仓记技术债，专门会话收敛（D3）。沉淀评审时凡依赖这些栈的 nw 代码一律不得直接复制。

### D 档：明确不收

- nw 相对模板多出的 14 个 shadcn 官方原语（accordion/alert/alert-dialog/avatar/checkbox/command/input-group/popover/progress/radio-group/select/sheet/switch/tooltip，走官方 CLI，决策 12）；
- DashboardGrid/KpiCard/MetricRenderer（143 行，与 ProjectDashboardMetric 后端 CRUD 死耦合）；
- compliance-insights、security-insights、signal-groups、metric-data、PathSelectModal、PreviewModal、UploadFileButton、jdy 双壳层（业务/S3/金蝶耦合）；
- data-table（registry 已有，nw 无更优版本）；
- page-header、settings-required-state（registry 已存在；仅需在实施 M1 时用 `fewbie doctor` 顺带核对 nw 副本经设计对齐后有无增量值得回灌，约 10 分钟）。

## 5. Non-Goals

1. 不让 nw 在本里程碑反向 `fewbie add` 这些 item（nw React 18、文件已存在必然冲突；壳层切换是独立大改动）；
2. 不重建 nw 前端（`fewbie init` 不支持非空目录，重建 = 搬 200 文件/51k LOC/54 路由 + React 19 升级，周级成本且换不来持续同步——模板级文件无 update 通道）；
3. 不做后端模块↔前端 item 的版本联动机制（D2）；
4. 不收敛 nw 的 sonner/next-themes/React 19 债（D3）；
5. 不改 basic 模板既有文件（A2 Provider 默认内置与否按 4-A2 子项建议：不动）；
6. 不沉淀任何需要运行时代码改写能力的安装逻辑（CLI 现状只复制 + 提示）。

## 6. 实施任务（D1 拍板后执行；全部在 fewbie 仓 dev 分支）

### M1: app-shell item

- 新建 `packages/fewbie-cli/registry/app-shell/item.json`（type `registry:block`，dependencies 仅 ui 原语所需——popover/tooltip 不属 npm 依赖故留空；files 两个）；
- 迁移 sidebar-chrome.tsx：全文英文（原文已是英文）；storage key 改为可配置常量；范例文件展示 nav 数组驱动的最小 shell；
- 验收：①item.json JSON.parse 通过、`fewbie add app-shell` 入临时项目无冲突报错；②临时项目 `npm run build`（模板 React 19）通过；③折叠/展开/flyout 手工浏览器抽检一次；④`grep nightwatch` 零命中；⑤双端消费自查（shadcn registry 协议字段齐全）。

### M2: query-client item + 范式文档

- `registry/query-client/item.json`（type `registry:lib`，dependencies `@tanstack/react-query@^5`，2 文件）；
- query-client.ts 给推荐默认值（retry/staleTime 取保守通用值，注释写明可调）；query-provider.tsx 为 client component；
- `fewbie-framework-design.md` gen api 章节追加「apits + react-query 消费范式」：解构空值守卫、queryKey 层级、mutation 失效约定，示例全部基于 apits 的 `[data, res]` 返回形态；
- 验收：临时项目 add 后 build 通过；范式片段在真实临时项目里可编译（放 example 页或脚本 tsc 验证，验证文件不入库）。

### M3（D1 选全做时）：password-checklist + sse-stream

- 两个独立 item、独立提交；password-checklist 先做 import 审计并在 item 描述标注 newbie account 规则同步义务；
- sse-stream 只迁传输内核，接口泛化（URL/body/headers/onEvent/abort），`grep copilot` 零命中；
- 验收同上：各自 add 入临时项目 + build；sse-stream 补一个最小 node 或浏览器手工流式验证（可用临时 Nest/HTTP server，证据存 /tmp 不入库）。

### M4: 登记与收尾

- B/C 两档作为「候选登记」附录写入 `fewbie-framework-design.md`（或本文档状态节），标注触发条件；
- `fewbie doctor` 顺带核对 page-header/settings-required-state 增量；
- fewbie 仓 dev 本地提交（英文 message、聚焦 why），不 push（push 由用户 GitHub Desktop 完成）。

### 通用验证基线（每个 M 都要过）

1. fewbie 仓自身 `tsc` 0 错 + 既有 CLI 测试通过（`packages/fewbie-cli/test`）；
2. 用 templates/basic 生成**临时项目**（`FEWBIE_TEMPLATE_PATH` 离线模式），`fewbie add <item>` → `npm install` → `npm run build` 全绿；
3. 所有 node 命令在运行中的 node 容器内执行，宿主机不装工具；
4. 每个 item 独立 commit；不修改与本 item 无关的模板文件。

## 7. 风险

| 风险 | 应对 |
|---|---|
| React 19 下 useSyncExternalStore/SSR hydration 行为差异 | M1 验收必须在模板（19.2）真实 build，不在 nw（18）自证 |
| item 多文件/目录结构与现有 store 加载器假设不符 | 动手前先读 `src/registry/store.ts` 的 resolveInstallSet，以 theme（2 文件）为先例 |
| password-checklist 规则漂移（后端改了前端件不知道） | item 描述明示手工同步义务；D2 立 companion 约定后再考虑声明式关联 |
| 沉淀件夹带 nw 技术债（toast/theme 栈） | 每个候选迁移前做 import 审计，禁用 react-toastify/手写 theme store；命中即先改写再迁 |
| 模板级文件仍无 doctor/update 通道，沉淀后未来演进照旧漂移 | 本计划接受该现状；「模板级文件更新机制」是独立框架议题，不在本计划范围 |

## 8. 证据索引（2026-10-08 盘点）

- fewbie：registry 8 item 目录 `packages/fewbie-cli/registry/`；add 机制 `src/commands/add.ts`；init 非空目录拒绝 `src/commands/init.ts#L87-L90`；update 仅覆盖带 item.json 的 item（`src/commands/update.ts`）；模板 19 文件、React 19.2/Next 16.3.6、instrumentation.ts 心跳内置。
- nw 前端：200 个 ts/tsx 文件、51,196 LOC、54 路由；sidebar-chrome.tsx 280 行/8 导出；dashboard layout 291 行（业务耦合）；project layout 535 行、jdy layout 105 行消费侧栏；Copilot 组件 933 行 + api/copilot 510 行；NotificationCenter 536 行；dashboard 143 行；react-query 89 文件；react-toastify 37 文件；PasswordChecklist 42 行；sse-stream 102 行、chat-stream 83 行；React 18.3/Next 16.2.12。
