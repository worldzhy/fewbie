# 错误契约语义化 + API Client 跨仓收敛实施方案

Status: 待评审（Plan Mode，评审通过后执行）
方案主文件置于框架真源仓 fewbie；执行横跨 newbie、newbie-modules、fewbie、nightwatch-backend、nightwatch-frontend 五个仓，按阶段各自提交。

## 〇、已拍板决策

1. **后端契约修正**：业务/认证错误返回语义化 HTTP 状态码，信封 `{code,error,data}` 与业务 code 保留；消除"业务错误走 200"的混合制
2. **三分类模型**（RFC 9110 + RFC 6749 invalid_grant）：

| 类别 | 场景 | 端点 | 状态码 | 前端应对 |
|---|---|---|---|---|
| ① 凭据无效（可纠正输入） | 密码错、验证码错、MFA challenge 无效、未设密码、重置参数错 | `/auth/login-*` 等凭据提交端点 | 400 | 表单错误 + toast，允许重试，不触发刷新 |
| ② access token 失效但会话存活 | bearer 过期 | 业务端点 | 401 | 静默 refresh + 重放，用户无感 |
| ③ 会话终结 | refresh token 过期/轮换吊销/缺失 | refresh 调用内部 | 401（client 内部路径消费） | 清会话、跳登录页带 redirectUrl |
| 伴生：账号状态 | 未激活/禁用 | 任意认证路径 | 403 | 账号状态提示 |
| 伴生：频控 | 尝试次数/高频 | 任意 | 429 | 冷却提示；基础设施可识别 |

3. **client 收敛**：fewbie registry api-client 为唯一真源；`Promise<T>` + throw `ApiError`；Web Locks 跨标签串行上收为框架标准；UI/路由无关（onError/onSessionExpired 钩子）
4. **nightwatch 宿主**：装配框架 client + 薄 apits 适配层；215 处 tuple 消除；死代码（skipErrorToast/SSR req/key-secret）清除

## 一、Repository Research（取证结论）

### 后端现状（newbie core）

- 成功信封 `{code:0,error:null,data}`：`newbie/packages/core/src/interceptors/http-response.interceptor.ts:12`
- `NewbieException`（8 类型）硬编码 **HTTP 200**：`newbie/packages/core/src/exceptions/newbie.exception.ts:7`
- 其余 HttpException 走真实状态码 + 同形信封：`newbie/packages/core/src/exception-filters/http.exception-filter.ts:27`
- 同流程状态码混乱的实证：密码错=200、用户不存在=401（`verification-code.strategy.ts:52`）、refresh 路径未激活=403（`refresh-token.strategy.ts:90`）；而改密流程同样的"当前密码不正确"已是 400（`account.controller.ts:77`）——映射有仓内先例
- 观测失真实证：`nightwatch-backend/src/modules/audit/http-access.interceptor.ts:70` 对失败登录记录 statusCode=200
- 消费方式：nightwatch-backend 依赖 npm `@devbie/newbie ^1.2.0`；改核心需发 1.x minor（上线前规则：不进 2），后端升级

### 注册表模块现状（newbie-modules）

- 14 个 NewbieException throw 点：password.strategy(4)、verification-code.strategy(1)、account.controller(3)、login-by-verificationcode.controller(3)、rate-limiter.guard(3)
- 凭据提交端点上的裸 UnauthorizedException 需审计改 400：verification-code.strategy（用户不存在/无效账户/验证码无效）、google.strategy（无 email）、共享登录服务中 MFA challenge token 校验（login-audit.ts 注释提及"unverifiable MFA challenge token"，执行时定位）
- 保持不动：refresh-token.strategy 的 401/403（类别③/账号状态）、api-key.verifier 的 401（资源访问凭据）、web-monitor/health/module-hub 的安装 token 401
- 契约测试 `account/auth/login-audit-coverage.test.ts:48` 的 REJECTION_PATTERN 必须同步纳入 BadRequestException，否则新增 400 分支破坏审计覆盖护栏

### fewbie 现状：`packages/fewbie-cli/registry/api-client/src/lib/api-client.ts`

- 正确骨架：axios 实例+拦截器、ApiError、onSessionExpired、标签内 single-flight、proactive scheduler、1.5s 重试
- 契约修正后的简化点：成功通道只需解包 `data`，**不再需要识别信封错误**；reject 通道读 `data.error.message`+`code`；refresh 响应按 `data.data.token` 解析
- 缺：Web Locks 跨标签串行、全局 onError 钩子、业务 code
- 装配：`fewbie add` 仅复制文件+依赖，支持 monorepo 源码 registry，无需先发 npm

### nightwatch-frontend 现状

- `src/api/fetch.ts` ~400 行，tuple 返回 `[data?, envelope?]`；215 处 `const [x] = await`（85 文件），tuple 第二元素零消费
- 双通道错误处理导致过双 toast 事故（本会话）；死代码：skipErrorToast / SSR req / key-secret 公网路径 全部零调用
- session 外迁点：storeTokenExpiry×3（login、totp-callback、use-oauth-callback）、initProactiveTokenRefresh（dashboard layout）、getAuthHeaders（copilot SSE 1 处）
- apits-gen 传输层无关（clientImportTemplate/clientConfigType），生成代码无需改；框架标准落点：client 在 `src/lib/api-client.ts`，生成 import 指 `../request`（fewbie-framework-design.md 第 81/110 行）
- 既有行为基线：全局 toast 是默认错误表面（63 catch vs 215+ 调用），react-query 吃 rejection；登录失败也弹 toast

## 二、阶段 A：newbie 核心契约（先发，一切的前置）

### 文件

- `.trae/documents/decisions/ADR-001-http-status-semantics-for-auth-failures.md`（新建，仓内首个 ADR，按 adr-template）：三分类模型、为何 200+信封混合制废弃、信封与业务 code 保留、跨宿主影响（client/审计日志/OpenAPI）
- `packages/core/src/exceptions/newbie.exception.ts`：异常映射表每项增加 `httpStatus`；构造函数使用之；未知类型仍 500

映射：

| 类型 | httpStatus |
|---|---|
| Login_WrongInput / Login_NoPassword / ResetPassword_WrongInput / ResetPassword_InvalidCode | 400 |
| Login_InactiveUser | 403 |
| Login_ExceededAttempts / Login_HighFrequency / Access_HighFrequency | 429 |

- 同步仓内 living 文档（执行时 grep 描述过 200 信封行为的文档并订正）

### 验证与发布

- 容器内 clean 全量构建 + 测试（跨工作区回流代码必须过框架仓自身 tsc/测试的硬规则）
- 按根目录 RELEASE_CHECKLIST 发 `latest`，版本 1.2.0 → 1.3.0（minor），`npm view` 核对 dist-tags
- 提交推送 dev

## 三、阶段 B：newbie-modules 注册表对齐 + 装配 nightwatch-backend

走 newbie-module-deliver 流程（registry 改动 → 装配 → 重启 → 冒烟 → 双仓提交）。

### registry 改动（packages/modules）

1. `account/auth/strategies/verification-code.strategy.ts`：凭据提交语义的 UnauthorizedException → BadRequestException（用户不存在、无效账户、验证码无效）；Login_InactiveUser 走映射即 403
2. `account/auth/strategies/google.strategy.ts`：无 email → BadRequestException
3. MFA challenge 校验点（执行时在共享 login 服务中定位）：无效/过期 totpToken → BadRequestException
4. `login-audit-coverage.test.ts`：REJECTION_PATTERN 增加 BadRequestException；跑契约测试确认所有拒绝分支仍命中审计记录、TOTP gate 护栏不破
5. 不动的白名单：refresh-token.strategy（401/403）、api-key.verifier（401）、安装 token 类 401
6. rate-limiter.guard 无需改代码（经映射表自动 429），但冒烟要验证状态码

### 装配与后端验证

- newbie CLI 重新装配 account/security 到 nightwatch-backend；后端升 `@devbie/newbie ^1.3.0`
- 后端测试（含 login-audit-coverage 契约测试）、dist 冒烟、干净重启
- 实测取证：错误密码=400 且信封 message 不变、登录成功 200、错误码超限=429（可构造）、access log 行 statusCode 如实、refresh 过期仍 401 且跳登录流程不受影响、audit 记录无缺失
- 双仓提交推送（registry 仓 + 后端仓），后端无 migration

## 四、阶段 C：fewbie api-client 框架件

### 文件

- `.trae/documents/decisions/ADR-001-envelope-aware-api-client.md`（新建）：引用 newbie ADR-001；单通道错误归一、Promise<T>/throw、Web Locks、UI/路由无关钩子
- `packages/fewbie-cli/registry/api-client/src/lib/api-client.ts` 重写要点：
  - 类型 `ApiEnvelope<T>`；`ApiError` 增 `code?: number`
  - 成功拦截器：信封对象解包返回 `body.data`；Blob/ArrayBuffer/字符串等非 JSON 原样透传（严格判定：普通对象且含 code+data 标记）
  - reject 拦截器：从 `response.data.error.message` 取消息、带 httpStatus 与 body.code；401 且非 `/auth/` 且未重放过 → Web Lock（锁名常量可配）内：先 re-check localStorage 新 token（他标签可能刚刷）→ 否则 refresh（解析 `data.data.token`/`tokenExpiresInSeconds`）→ 失败 1.5s 重试一次 → 仍失败 clearSession + onSessionExpired；成功带新 token 重放
  - 每条最终拒绝恰好一次 `onError(ApiError)`；refresh/重放透传不重复触发（结构上消灭双 toast 类别）
  - 导出：apiClient（Promise<T>）、api、getAccessToken、setSession、clearSession、initProactiveTokenRefresh、onSessionExpired、onError、ApiError
  - 项目常量区保留（BASE_URL env、storage keys、refresh path、lock name）
- `item.json` 描述更新；`fewbie-framework-design.md` 同步（81/151 行附近）

### 验证

- 容器内 tsc 校验 registry 文件 + prettier；提交推送 dev
- 不发 npm（本地装配走源码 registry）；需要 fewbie update 通道时另走发布清单，由用户拍板

## 五、阶段 D：nightwatch-frontend 宿主改造

### 文件与步骤

1. 从 fewbie 源码 registry 装配 api-client 到 `src/lib/api-client.ts`（先验证 CLI 对未 init 项目的前置；不满足则等价手工复制）；常量改 nightwatch 值：`NEXT_PUBLIC_BASE_URL`、`nightwatch-access-token(-expires-at)`、`nightwatch-refresh-token`
2. 新建 `src/api/request.ts`：
   - `onError` → sonner `toast.error(message)`（2 秒，与现状一致）
   - `onSessionExpired` → 非登录页 `window.location.replace(login?redirectUrl=...)`
   - apits 单参约定：get/delete 透传整份 opts；post/put/patch 取 `opts.data` + 其余 config；FormData/URLSearchParams 原样；返回 `Promise<RES>`
   - `export type ClientRequestConfig = AxiosRequestConfig`
3. `apits.config.ts` import 模板改 `../request`；`_gen/api.ts` 同步（优先重新生成；后端不可达时等价单行改，下次 apits 核对 drift）
4. 迁移：3 处 session 调用 → setSession；dashboard layout 的 initProactiveTokenRefresh 改 import 并保证 request 模块被加载；copilot SSE 的 getAuthHeaders → getAccessToken 内联
5. 删除 `src/api/fetch.ts`、`src/api/type.ts`；grep 清场：@/api/fetch、ApiEnvelope、ApiResponse、storeTokenExpiry、skipErrorToast、_needToBeLoggedIn、EnvelopeError
6. codemod 215 处 `const [a] = await` → `const a = await`；全量 diff 人工过（res ?? {} 兜底、Promise.all、手写返回 tuple 的函数）；tsc 清零

### 验证（容器 + 浏览器）

- tsc 零错误、eslint 仅剩既有无关项；清 .next/.next-internal/.turbo 干净重启
- 矩阵：错误密码（网络面板=400、单 toast、无 refresh 请求发出、表单 loading 复位）；登录成功与 TOTP；伪造过期 access token（静默 refresh+重放、无 toast）；清 refresh cookie（清会话+带 redirectUrl 跳转）；文件上传与 blob 下载；copilot SSE Bearer；双标签 Web Locks（B 标签刷新时 A 不产生 401）
- 提交推送 dev

## 六、顺序与依赖

A 发布 → B 装配（后端新契约上线）→ C（可与 B 并行开发）→ D（必须在 B 上线后验证）。
旧前端对新契约天然兼容（reject 通道本就读信封 error.message），切换窗口无外部风险。

## 七、Risks

| 风险 | 应对 |
|---|---|
| 凭据端点 401→400 漏改某分支，造成语义不一致 | 阶段 B 以 login-audit 契约测试 + grep 全量审计认证目录所有 throw；冒烟矩阵覆盖各登录渠道（密码/验证码/TOTP/OAuth） |
| 契约测试漏更新阻断后端 CI | REJECTION_PATTERN 纳入 BadRequestException 作为显式步骤，先改测试后改实现，本地跑绿再提交 |
| 1.3.0 发布影响其他 @devbie/newbie 消费方 | 上线前无外部消费方（用户既定事实）；minor 递增不进 2；发布前 npm view 核对 |
| 信封解包误伤普通 JSON | 严格标记判定 + 非对象透传 + 上传下载实测 |
| 215 处机械改造语义遗漏 | codemod + 全量 diff 人工过 + tsc；tuple 第二元素零消费已取证 |
| 并行会话冲突 | 每阶段开始 git status/log + topics 检查；提交只 add 本范围文件 |
