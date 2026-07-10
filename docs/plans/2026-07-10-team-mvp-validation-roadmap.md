# Team MVP Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** 把已能运行的 Performance Prompter MVP 推进到“团队可稳定试用、价值可量化、是否扩展可决策”的状态。

**Architecture:** 保持现有静态前端、零依赖 Node API、OpenAI-compatible 模型代理和 Vercel/Docker 双部署结构。先补测试与评测层，不引入数据库或正式账号系统；只有核心质量和团队采用率达到门槛后，才进入协作架构设计。

**Tech Stack:** HTML/CSS/原生 JavaScript、Node.js 20+、`node:test`、OpenAI-compatible Chat Completions、Vercel、Docker。

---

## 目标与约束

项目要解决的问题不是“生成任意视频提示词”，而是让短剧团队把剧本文戏稳定转换为 Seedance 可执行的表演指令。核心价值是减少人工 Prompt 制作时间，同时保住人物一致性、情绪节拍、对白语言和可观测动作质量。

本轮约束：

- 不改原 Skill 的公开行为，不扩展到动作戏。
- 不引入运行时依赖、数据库或正式账号体系。
- 不把 API Key、团队密码、剧本正文写入日志或 Git。
- P1/P2 未达标前，不投入项目共享、历史版本和用量后台。

## 阶段验收门槛

| 维度 | MVP 试用门槛 |
|---|---|
| 格式合规 | 固定评测集 100% 含合法时间戳、一致性锁定、负向约束 |
| 市场语言 | 欧美用例引号内对白 100% 无中文残留；国内用例保持中文 |
| 表演可观测性 | 至少 90% 镜头包含面部/眼神、呼吸、肢体或道具中的两类信号 |
| 首稿可用率 | 团队评分为“可直接用或轻改可用”的结果不少于 80% |
| 人工修改量 | 可用结果的文本修改比例中位数不高于 20% |
| 稳定性 | 20 次连续生成无前端崩溃；模型失败时兜底路径可完成任务 |
| 延迟 | P50 不高于 30 秒，P95 不高于 60 秒 |
| 安全 | 未登录 API 统一 401；前端、响应和日志不暴露服务端 Key |

### Task 1: 收口当前 MVP Git 基线

**Files:**
- Review: `README.md`
- Review: `app.js`
- Review: `index.html`
- Review: `styles.css`
- Review: `server.js`
- Review: `middleware.js`
- Review: `api/[...path].js`
- Review: `Dockerfile`
- Review: `vercel.json`
- Review: `.env.example`
- Review: `.gitignore`
- Review: `.dockerignore`
- Review: `Progress.md`

**Step 1: 检查密钥与临时文件**

Run: `rg -n "(sk-|APP_PASSWORD=.+|OPENAI_API_KEY=.+)" . -g '!\.git/**' -g '!docs/plans/**'`

Expected: 除占位说明外没有真实密钥或密码。

**Step 2: 检查当前改动边界**

Run: `git status --short && git diff --check`

Expected: 只有本次网页 MVP、项目管理文档和部署相关文件；无空白错误。

**Step 3: 运行当前静态检查**

Run: `npm run check`

Expected: 两个 `node --check` 命令均通过。

**Step 4: 人工审阅后建立基线提交**

Run: `git add README.md app.js index.html styles.css server.js middleware.js api Dockerfile vercel.json package.json .env.example .gitignore .dockerignore AGENTS.md Progress.md docs/plans`

Run: `git commit -m "feat: add team performance prompt workbench"`

Expected: 网页 MVP 获得单一目的、可回滚的 Git 基线。执行提交前需用户明确授权。

### Task 2: 建立零依赖接口回归测试

**Files:**
- Create: `tests/server.test.js`
- Modify: `package.json`
- Modify: `server.js`

**Step 1: 增加测试命令**

在 `package.json` 的 `scripts` 中增加 `"test": "node --test tests/*.test.js"`，保留现有 `start` 和 `check`。

**Step 2: 写入当前应失败的健康检查测试**

使用 `node:test` 和 `node:http`，把 `require('../server')` 返回的 request listener 挂到随机端口。断言 `GET /healthz` 与 `HEAD /healthz` 都返回 200，且 HEAD 没有响应体。

**Step 3: 运行测试确认失败**

Run: `npm test`

Expected: `HEAD /healthz` 用例失败，当前行为不是 200。

**Step 4: 最小修正健康检查路由**

修改 `server.js`，让 `/healthz` 和 `/api/healthz` 同时接受 GET 与 HEAD；不改变其他 API 的鉴权行为。

**Step 5: 补齐核心接口用例**

覆盖：首页 200、状态接口字段、未知 API 405/404、空 JSON 错误、无 Key 的模型请求错误、TXT/MD 上传成功、不支持扩展名失败、路径穿越被拒绝。

**Step 6: 运行全部验证**

Run: `npm test && npm run check && git diff --check`

Expected: 全部通过。

**Step 7: 提交**

Run: `git add package.json server.js tests/server.test.js Progress.md && git commit -m "test: cover core workbench api flows"`

### Task 3: 建立真实模型端到端冒烟脚本

**Files:**
- Create: `scripts/smoke-ai.mjs`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: 编写失败优先的输出契约校验**

脚本读取 `examples/example-billionaire-reveal.md`，依次请求 `/api/generate-profile` 与 `/api/generate-prompt`，并断言人物档案字段、镜头时间戳、一致性锁定、负向约束、英文对白和肌肉/呼吸信号存在。脚本只输出状态、耗时、模型名和错误摘要，不输出 Key。

**Step 2: 增加运行命令**

在 `package.json` 增加 `"smoke:ai": "node scripts/smoke-ai.mjs"`。

**Step 3: 无 Key 运行并确认安全失败**

Run: `npm run smoke:ai`

Expected: 明确提示缺少模型配置，退出码非 0，日志不含敏感值。

**Step 4: 使用团队测试 Key 运行**

Run: `npm run smoke:ai`

Expected: 人物档案和 Prompt 两段调用均成功，所有结构断言通过，并记录总耗时。Key 通过环境变量提供，不写入命令历史、文件或结果文档。

**Step 5: 连续运行 5 次**

Expected: 5 次均完成；记录成功率、P50/P95、输入输出 token 或供应商返回的可用计量字段。

**Step 6: 提交**

Run: `git add scripts/smoke-ai.mjs package.json .env.example README.md Progress.md && git commit -m "test: add real model smoke workflow"`

### Task 4: 建立表演 Prompt 固定评测集

**Files:**
- Create: `evals/README.md`
- Create: `evals/rubric.md`
- Create: `evals/cases.json`
- Create: `scripts/run-evals.mjs`
- Modify: `package.json`

**Step 1: 定义 12 个代表性用例**

覆盖身份揭露、压抑崩溃、争吵、告白、重聚、背叛、权力对峙、无对白独角戏；欧美 8 例、国内 4 例；时长覆盖 9/12/15 秒；至少 2 例故意超过 15 秒以验证拆条。

**Step 2: 固化机器可判定规则**

`scripts/run-evals.mjs` 对每个结果检查时间戳连续性、总时长、固定结尾段、对白语言、无效参数黑名单、每镜头可观测信号数量和长场次拆条说明。

**Step 3: 固化人工评分量表**

`evals/rubric.md` 使用 1-5 分评价人物一致性、情绪节拍、动作可执行性、对白自然度和首稿可用性，并记录修改比例与失败原因。

**Step 4: 增加评测命令**

在 `package.json` 增加 `"eval": "node scripts/run-evals.mjs"`。

**Step 5: 运行评测**

Run: `npm run eval`

Expected: 生成带时间戳的本地 JSON/Markdown 报告；原始剧本和敏感配置不上传到第三方日志。

**Step 6: 对照阶段门槛**

若格式或语言未达 100%，先修系统提示与确定性后处理；若可观测性或可用率不足，再调整 Skill 规则。不要用增加 UI 功能掩盖输出质量问题。

**Step 7: 提交**

Run: `git add evals scripts/run-evals.mjs package.json Progress.md && git commit -m "test: add performance prompt evaluation suite"`

### Task 5: 完成安全与部署回归

**Files:**
- Create: `tests/auth.test.js`
- Create: `docs/deployment-checklist.md`
- Modify: `middleware.js`
- Modify: `server.js`
- Modify: `README.md`

**Step 1: 写 Basic Auth 回归用例**

覆盖无凭据 401、错误凭据 401、正确凭据 200、健康检查 GET/HEAD 200、OPTIONS 不被阻塞、服务端 Key 不出现在 `/api/status`。

**Step 2: 校验客户端配置开关**

覆盖模型白名单、禁止 Base URL 覆盖、允许/禁止临时个人 Key；确认错误信息不回显 Key。

**Step 3: 验证两种部署**

Run: `docker build -t performance-prompter:test .`

Run: `vercel --prod`

Expected: Docker 与 Vercel 均通过首页、健康检查、鉴权、MD/DOCX 上传和真实模型冒烟。生产部署属于外部状态变更，执行前需用户明确授权。

**Step 4: 提交**

Run: `git add tests/auth.test.js docs/deployment-checklist.md middleware.js server.js README.md Progress.md && git commit -m "test: harden authenticated deployment"`

### Task 6: 运行 3-5 人团队试用

**Files:**
- Create: `docs/pilot-runbook.md`
- Create: `docs/pilot-scorecard.md`
- Modify: `Progress.md`

**Step 1: 统一试用任务**

每名用户至少完成：导入一份真实剧本、校正人设、生成 3 个不同类型场次、执行一次全局调教、复制成品 Prompt。

**Step 2: 只记录必要指标**

记录完成时间、生成次数、首稿是否可用、修改比例、失败步骤、最想保留的能力和最大阻碍。试用文档不记录剧本全文、Key 或密码。

**Step 3: 达到最小样本量**

Expected: 至少 3 名用户、15 个真实场次、每类核心场景至少 2 个样本。

**Step 4: 汇总结果**

对照阶段门槛，区分输出质量问题、模型稳定性问题、文件兼容问题和交互问题；只修复高频阻塞。

**Step 5: 提交**

Run: `git add docs/pilot-runbook.md docs/pilot-scorecard.md Progress.md && git commit -m "docs: record team pilot results"`

### Task 7: 做 P3 Go/No-Go 决策

**Files:**
- Create: `docs/decisions/001-productization-scope.md`
- Modify: `Progress.md`

**Step 1: 判断核心价值是否成立**

Go 条件：格式与语言硬门槛全部通过，首稿可用率至少 80%，人工修改比例中位数不高于 20%，团队明确愿意持续使用。

**Step 2: 选择一个方向**

- `No-Go / 保持轻量`：继续使用 Basic Auth + 浏览器本地项目，不建设数据库。
- `Go / 团队产品化`：另开架构设计，明确账号、项目共享、版本、用量、数据保留和权限边界。

**Step 3: 先征得用户确认**

正式账号、数据库 schema、共享数据格式会改变兼容性和运维成本，必须在实施前由用户确认，不在本计划中预设技术方案。

**Step 4: 更新项目状态**

Run: `git add docs/decisions/001-productization-scope.md Progress.md && git commit -m "docs: decide productization scope"`

## 推荐执行顺序

严格按 `Task 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7` 推进。Task 1-2 解决可信基线，Task 3-4 回答“生成质量是否成立”，Task 5 回答“是否能安全交付”，Task 6 回答“团队是否真的采用”，Task 7 才决定是否值得引入更重的协作架构。
