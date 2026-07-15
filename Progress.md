# Progress

## 目标
把现有 AIGC 视频表演提示词 skill 做成供团队成员使用的网页工具：导入剧本、确认人物表演档案、选中目标场次，并生成 Seedance 可识别、可直接使用的标准表演 prompt。

当前阶段的首要目标不是继续增加功能，而是证明团队能稳定获得高质量结果：真实模型链路可用、输出质量可衡量、关键流程可回归、成本和访问风险可控。

## 范围
- 零依赖 Node 后端，负责文件抽取和 OpenAI-compatible 大模型代理。
- 支持拖入/选择 `pdf`、`docx`、`doc`、`txt`、`md`。
- 支持在浏览器本地保存项目数据、剧本、人设、调教记录和输出 prompt。
- 基于现有 `SKILL.md`、`references/`、`examples/` 生成 AI 系统提示，并保留前端本地规则兜底。
- 当前不包含正式账号体系、云端项目共享、历史版本和团队用量统计。

## 当前状态
- 阶段判断：功能型 MVP 已完成，处于真实模型验证和团队试用前；尚不能视为稳定生产版。
- Skill 规则、5 份参考知识库和 2 个完整示例已存在，并已提交到 `main`。
- 网页已覆盖项目名、目标市场、文件上传、剧本输入、人设草案/AI 生成与确认、全局调教、Prompt 生成、复制和下载。
- 前端 P0/P1 可用性改版已完成：主流程按四步工作流展示，模型配置移入设置抽屉，场次和人设改为可确认对象，移动端采用单列步骤流。
- 后端已提供 `/api/status`、`/api/extract-file`、`/api/generate-profile`、`/api/generate-prompt`、`/api/tune` 和 `/healthz`。
- 本地无模型 Key 时，页面可使用规则兜底完成主流程。
- 已具备可选 Basic Auth、Docker 和 Vercel 部署入口；提交 `c1a59ee` 已发布到 Vercel Production，线上默认无需登录。
- P0 已完成：网页 MVP 与部署配置已形成 Git 基线，并建立零依赖 Node 接口回归测试。
- 回归测试覆盖鉴权启用/禁用的健康检查、受保护 API、静态文件白名单、目录穿越、状态脱敏、错误响应、无模型 Key、Markdown 上传和非法扩展名。
- 已修复 `HEAD /healthz` 在鉴权环境返回 401、非前端仓库文件可被静态读取、异步路由异常绕过顶层错误处理并终止进程三个问题。
- P1 机器验证已完成：DeepSeek `deepseek-chat` 通过 5 次端到端冒烟和 12 个固定场景机器评测；人工质量评分与准确成本仍待完成。
- 最终机器硬门槛为 12/12，通过率 100%；可观测镜头覆盖 100%，P50 20.0 秒，P95 34.0 秒。
- 安全与部署回归已补齐：生产 CORS 默认收紧、API 禁止缓存、静态页面增加 CSP，鉴权与模型配置开关均有自动化测试。
- Markdown 与合成 DOCX 文件抽取均已纳入自动化回归。
- Vercel preview 本地构建通过；Middleware 已改为当前 Vercel 支持的默认导出，并通过公开路径白名单阻止访问仓库内非前端文件。
- Vercel Production 已配置 DeepSeek 模型参数和服务端安全开关；客户端不能覆盖 API Key 或 Base URL。
- 生产已认证端到端补验通过：`deepseek-chat` 成功生成人物档案和 Seedance Prompt，两个输出均通过现有机器契约。
- 本地 `main` 已吸收结构化动作与物理因果规则：主体优先、动作从整体到局部、显式环境原因-结果、扩展负向约束和后端固定镜头时间表；线上 Production 已发布该批改动。
- 新规则的 12 场景机器评测均取得 PASS 输出，其中 1 条因 TLS 中断后原样重试；可观测覆盖与物理因果检查均为 100%。

## 下一步
1. **线上试用**：在无需登录的线上版本上开始小范围试用，并监控模型调用失败率与额度消耗。
2. **P1 人工验收**：由至少一名短剧制作成员按 `evals/rubric.md` 评分，并记录首稿采用率和人工修改比例。
3. **P2：小范围团队试用**：3-5 名真实用户完成至少 15 次任务，记录首稿采用率、人工修改量、失败原因和高频需求。
4. **P3：扩展决策**：只有 P1/P2 达标后，再决定继续保持轻量内网工具，还是建设账号、共享、版本、用量统计等协作能力。

详细执行计划见 `docs/plans/2026-07-10-team-mvp-validation-roadmap.md`。

## 风险
- 当前测试覆盖 Node API，但还没有浏览器自动化回归；前端交互改动仍需浏览器验证。
- 本地规则兜底只能用于演示，不等价于真实模型生成质量。
- 当前 API 未保留模型 token usage，尚不能给出准确单次成本。
- DeepSeek 针对性复测出现过一次 TLS 建连重置，原样重试成功；仍需在团队试用中记录网络失败率。
- 当前 MVP 仅提供轻量团队密码保护，不是完整账号权限系统。
- PDF 扫描件暂不做 OCR；Vercel 上 PDF/DOC 解析能力弱于 Docker 部署。
- 自动识别人物、情绪和对白翻译仍需人工确认；机器硬门槛已建立，但不能替代人工内容判断。
- 公开部署会消耗模型额度；默认关闭登录后，任何拿到链接的人都可能调用模型，需在试用期监控调用失败率与额度消耗。
- 当前机器未安装 Docker CLI，容器构建与运行验证尚未执行。
- Vercel preview 环境当前没有 `ENABLE_AUTH=true`，按默认配置无需登录。
- Vercel 构建提示 Node `>=20` 会自动跟随未来主版本；正式长期运行前需决定是否固定 Node 主版本。
- 物理因果契约只覆盖明确出现的风、雨、雾和光线词，无法替代真实成片检查；截图中的效果百分比未经本项目验证。
- 生产默认不启用登录，公开链接可能被任意调用；如需限制访问，需在 Vercel 设置 `ENABLE_AUTH=true` 和 `APP_PASSWORD` 后重新部署。

## 关键决策
- 先验证“能否稳定减少 Prompt 制作时间并提高表演质量”，暂缓账号、数据库和多人协作扩展。
- 保持零运行时依赖，优先使用 Node 内置测试能力建立回归基线。
- 真实模型采用 OpenAI-compatible Chat Completions，便于切换 OpenAI 或兼容网关。
- 先复用现有 Skill 的 B 格式、微表情、身体动作和负向约束规则，不扩大原 Skill 的动作戏边界。
- API Key 默认只放后端环境变量；前端临时个人 Key 仅用于受信团队试用，不写入项目存档。
- 快速试用继续使用 Vercel；完整文件解析或更长任务优先使用 Docker。
- 数据库结构、正式账号体系和共享数据格式属于 P3 决策，实施前需用户确认。

## 验证结果
- 2026-07-10：P0 MVP 基线提交完成，提交为 `50ef6ce`。
- 2026-07-10：`npm test` 通过，10 项接口回归全部通过。
- 2026-07-10：`npm run check` 通过。
- 2026-07-10：`git diff --check` 通过。
- 2026-07-10：本地独立端口验证通过：首页 200、`GET /healthz` 返回 `{"ok":true}`、`GET /api/status` 正常返回能力状态。
- 2026-07-10：本地 Markdown 上传抽取通过，使用 `plain-text`，抽取 3356 字符。
- 2026-07-10：线上主页返回 200，`GET /healthz` 返回 200，未登录 `/api/status` 返回 401。
- 2026-07-10：本地已修复并回归验证 `HEAD /healthz`；线上仍待后续授权部署。
- 2026-07-10：`npm run smoke:ai` 在无 Key 环境按预期安全失败，未发起模型调用；真实模型冒烟待配置 Key。
- 2026-07-10：`npm run eval:check` 通过，12 个固定用例满足市场、对白、时长和拆条分布约束。
- 2026-07-10：测试扩展为 15 项并全部通过，包含 Prompt 契约与评测数据校验。
- 2026-07-10：`npm run eval` 在无 Key 环境按预期安全失败，未生成伪结果报告。
- 2026-07-10：DeepSeek 端到端冒烟 5/5 通过，P50 20.26 秒，P95 21.70 秒。
- 2026-07-10：12 场景正式复跑及校验器修正后，机器硬门槛 12/12、可观测覆盖 100%、P50 20.00 秒、P95 33.97 秒。
- 2026-07-10：P1 机器评测摘要见 `evals/baseline-2026-07-10.md`。
- 2026-07-10：安全、鉴权、模型配置与文件抽取自动化测试扩展为 24 项并全部通过。
- 2026-07-10：生产响应头回归通过：可信 CORS、`no-store`、CSP、`nosniff`、防嵌入与 Referrer Policy。
- 2026-07-10：合成 DOCX 上传抽取回归通过。
- 2026-07-10：`vercel build --yes` preview 构建通过，默认 Middleware 与安全头已进入构建产物。
- 2026-07-10：本地 Vercel 路由验证通过：首页 200、非前端 `/server.js` 404、健康检查 GET/HEAD 200、生产 CORS 与安全头生效。
- 2026-07-10：preview 未配置 `APP_PASSWORD`，本地 Vercel API 鉴权无法作为发布证据；独立生产配置测试已覆盖无凭据/错误凭据 401、正确凭据 200。
- 2026-07-10：`npm audit --omit=dev --audit-level=high` 通过，0 个已知漏洞。
- 2026-07-10：`.dockerignore` 已排除 `.env`、`.vercel` 与本地评测结果，避免把敏感配置和模型输出发送到 Docker 构建上下文。
- 2026-07-10：DeepSeek 的 `OPENAI_API_KEY`、Base URL、模型名、模型参数及三个服务端安全开关已作为加密变量写入 Vercel Production；变量清单核对通过，未输出密钥明文。
- 2026-07-10：提交 `f77dfbe` 已成功发布为 Vercel Production，稳定入口为 `https://performance-prompter-workbench.vercel.app`，部署状态为 READY。
- 2026-07-10：生产黑盒验证通过：首页 200，健康检查 GET/HEAD 200，未认证 `/api/status` 401，`/server.js` 与 `/.env` 均为 404；CSP、HSTS、`nosniff`、防嵌入、Referrer Policy 和健康接口 `no-store` 均生效。
- 2026-07-10：已认证生产模型调用待补验，原因是本地 `.env` 的 `APP_PASSWORD` 为空，且 Vercel 中现有密码为不可回读的加密值。
- 2026-07-10：新团队密码已从本地 `.env` 通过标准输入加密同步到 Vercel Production，并完成新部署；同步和验证日志均未输出密码或 API Key。
- 2026-07-10：已认证生产状态检查通过：HTTP 200、`aiConfigured=true`、`authEnabled=true`、模型为 `deepseek-chat`。
- 2026-07-10：生产端到端真实生成通过：人物档案 2568 字符、19.262 秒、契约 PASS；Prompt 740 字符、3 个镜头、可观测覆盖 100%、6.725 秒、契约 PASS。
- 2026-07-10：生产补验发现 `vercel.json` 将客户端 API Key 覆盖硬编码为开启，覆盖了控制台安全值；已在提交 `d318748` 改为关闭并增加部署配置回归测试。
- 2026-07-10：安全修复后 25/25 自动化测试、`npm run check`、`git diff --check` 全部通过；线上状态显示客户端 API Key/Base URL 覆盖均为 `false`，假 Key 覆盖拒绝与不回显探针 PASS。
- 2026-07-10：提交 `d318748` 已发布为 Vercel Production，部署 `dpl_4QX2wKacmzZMKRsxohiCQWSY2vPG` 状态 READY，稳定入口保持 `https://performance-prompter-workbench.vercel.app`。
- 2026-07-10：进一步确认 `vercel.json` 的 OpenAI 模型白名单会覆盖 Vercel Production 中的 DeepSeek 白名单；提交 `ec9a7f0` 已移除部署文件中的环境专属模型配置，统一由 Vercel Production 管理。
- 2026-07-10：提交 `ec9a7f0` 已发布为 Vercel Production，部署 `dpl_FdA8MrK2dYs6TLa6qhHoLEYWM5iR` 状态 READY；最终状态为模型 `deepseek-chat`，白名单仅含 `deepseek-chat`、`deepseek-reasoner`，客户端 API Key/Base URL 覆盖均为 `false`。
- 2026-07-14：新增 `references/structured-physical-direction.md`，将截图技巧收敛为主体优先、动作分层、环境物理因果和扩展负向约束；明确不采信未经验证的效果百分比。
- 2026-07-14：Skill、服务端生成指令、前端本地兜底、格式参考和两个示例已同步；旧负向模板仅保留为拒绝测试。
- 2026-07-14：契约新增显式环境物理因果检查，评测反馈后排除呼吸气流误报，并补充高光与“盯/凝视/注视/看向/望向”等有效信号。
- 2026-07-14：后端增加确定性镜头时间表，4 秒为 2 镜头，9/12/15 秒为 3 镜头；模型不得新增、重复或改写时间戳。
- 2026-07-14：`npm test` 29/29、`npm run check`、Skill `quick_validate.py` 与 `git diff --check` 全部通过；真实 DeepSeek 冒烟 1/1 通过。
- 2026-07-14：最终 12 场景均取得 PASS 输出，其中 1 条上游 TLS 中断后原样重试；可观测覆盖 100%，3 个显式物理因果镜头全部通过，P50 17.253 秒，P95 25.893 秒。详见 `evals/baseline-2026-07-14-structured-physical.md`。
- 2026-07-15：鉴权改为显式开关；仅 `ENABLE_AUTH=true` 且存在 `APP_PASSWORD` 时启用 Basic Auth，默认无需设置用户名和密码；29/29 自动化测试、语法检查和差异检查通过。
- 2026-07-15：提交 `c1a59ee` 发布为 Vercel Production，部署 `dpl_FGgtbp7iJzMoAC3HuwfVVQybmf17` 状态 READY；首页 200、`/healthz` 200、未登录 `/api/status` 200 且 `authEnabled=false`，非公开文件路径 404。
- 2026-07-15：按 UI/UX 重构设计完成 P0/P1 前端改版；页面改为“剧本 -> 人设 -> 场次 -> Prompt”四步工作流，加入候选场次卡片、人物卡片、设置抽屉、前置条件状态和 Prompt 镜头预览。
- 2026-07-15：浏览器验收通过桌面四步切换、场次点击选择、人设卡片数量、设置抽屉和 375px 移动端无页面横向滚动；`npm run check` 与 `npm test` 29/29 通过。
- 历史记录：线上 Markdown/DOCX 抽取、浏览器主流程和桌面/移动响应式检查曾通过，但本轮未重新执行带密码的浏览器验证。
- 待验证：人工首稿采用率、人工修改比例、五维质量评分和准确 token/成本。
