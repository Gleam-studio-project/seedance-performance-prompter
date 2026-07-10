# performance-prompter — Seedance 2.0 表演提示词生成 Skill

读取整体剧本 + 人设，为字节 Seedance 2.0 视频生成模型产出**文戏/情感戏**的高质量表演提示词，让 AI 生成的人物表演真实、自然、细腻、生动。主打欧美市场海外短剧（ReelShort / DramaBox 类，英文对白），兼容国内全题材。

## 核心思路

现有 Seedance prompt 工具都聚焦运镜/画质/视觉奇观，本 skill 专注被忽略的核心价值——**表演**：

- **两层管线**：全剧本人设层（一次性建立「人物表演档案」：性格底色、关系动力学、情感弧线、专属表演习惯 Tell、微表情库）→ 场次生成层（节拍拆分 → 查词库 → 按实测有效的 Seedance B 格式填槽输出）
- **表演知识库**：FACS 面部动作编码词表、情绪-身体映射、潜台词外化库、12 个高频情感场景节拍模板
- **格式对齐**：输出严格遵守社区 1940 条真实 prompt 验证过的时间戳分镜格式（引号英文对白 + 中文语气标注 + 一致性锁定段 + 负向约束段）

## 使用

1. 将本目录放入 `~/.claude/skills/performance-prompter`（或在 Claude Code 中直接引用 SKILL.md）
2. 提供：整体剧本（或人物设定+前情）+ 目标场次 +（可选）人物参考图
3. Claude 先建人物表演档案供确认，再逐场输出可直接粘贴进 Seedance 的提示词

## 团队网页 MVP

本仓库现在也包含一个可落地的团队网页工作台：

- 拖入/选择 `pdf`、`docx`、`doc`、`txt`、`md` 剧本文件，后端抽取文本填入剧本区
- AI 生成人物表演档案，人工确认后再生成场次 prompt
- 选中剧本中的目标剧情，一键生成 Seedance B 格式表演 prompt
- 全局调教区可把团队偏好转成后续生成规则
- 无 API Key 或模型请求失败时，自动保留本地规则兜底生成

### 启动

```bash
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL
npm start
```

然后打开：

```text
http://127.0.0.1:4174
```

也可以直接打开 `index.html`；如需文件上传和真实大模型，需要同时运行 `npm start`。

### 模型配置

默认使用 OpenAI-compatible Chat Completions API：

```env
OPENAI_API_KEY=你的 Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1
OPENAI_MODEL_OPTIONS=gpt-4.1,gpt-4.1-mini,gpt-4o,o3,o4-mini
ALLOW_MODEL_CONFIG=true
ALLOW_CLIENT_API_KEY=false
ALLOW_CLIENT_BASE_URL=false
PORT=4174
```

如果你们使用兼容 OpenAI 协议的网关或私有模型，只需要改 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`。

页面里的“模型设置”由后端开关控制：

- `ALLOW_MODEL_CONFIG=true`：允许在页面选择/填写模型名，模型必须在 `OPENAI_MODEL_OPTIONS` 内。
- `ALLOW_CLIENT_API_KEY=true`：允许成员在浏览器会话里临时填写个人 Key；Key 不写入项目存档。
- `ALLOW_CLIENT_BASE_URL=true`：允许成员覆盖 Base URL，仅建议可信内网部署开启。

### 部署上线

可以上线给团队使用，但生产环境至少需要配置：

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=4174
OPENAI_API_KEY=你的服务端 Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1
OPENAI_MODEL_OPTIONS=gpt-4.1,gpt-4.1-mini,gpt-4o,o3,o4-mini
ALLOW_MODEL_CONFIG=true
ALLOW_CLIENT_API_KEY=false
ALLOW_CLIENT_BASE_URL=false
CORS_ORIGIN=
APP_USER=team
APP_PASSWORD=换成强密码
```

最简单的容器部署方式：

```bash
docker build -t performance-prompter .
docker run --env-file .env -p 4174:4174 performance-prompter
```

部署平台如果会自动注入 `PORT`，不要在平台里写死端口；保留 `HOST=0.0.0.0` 即可。公网环境建议始终设置 `APP_PASSWORD`，否则任何拿到链接的人都能消耗模型额度。

前端和 API 同域部署时保持 `CORS_ORIGIN` 为空即可；生产环境会默认拒绝跨域 API 调用。只有前端部署在另一个可信域名时，才把该域名完整填写为 `CORS_ORIGIN=https://your-app.example.com`。

也可以直接部署到 Vercel：

```bash
vercel --prod
```

Vercel 版本会使用 `api/[...path].js` 作为 Serverless API 入口，并用后端 Basic Auth 保护 API；前端会在未登录时显示团队访问遮罩。当前 `vercel.json` 默认允许页面配置模型名和临时个人 Key，但不允许覆盖 Base URL；如果要使用团队统一 Key，需在 Vercel 项目环境变量里设置 `OPENAI_API_KEY`。Vercel 可稳定支持 `docx/txt/md`，`pdf` 依赖内置轻量解析器，扫描件仍需 OCR。

团队统一 Key 模式还必须在 Vercel 环境变量中设置 `APP_PASSWORD`，并覆盖 `ALLOW_CLIENT_API_KEY=false`、`ALLOW_CLIENT_BASE_URL=false`。Middleware 只公开首页、`app.js`、`styles.css`、健康检查和 API，仓库内其他文件统一返回 404。

健康检查地址：

```text
/healthz
```

### 真实模型冒烟验证

配置服务端模型环境变量后，可运行端到端冒烟测试。脚本会启动临时本地 API，依次生成人物档案和 Seedance Prompt，并验证时间戳、固定约束段、对白语言及可观测表演信号。

```bash
npm run smoke:ai
```

正式 P1 验证连续运行 5 次：

```bash
SMOKE_RUNS=5 npm run smoke:ai
```

脚本只输出模型名、耗时、字符量和契约检查结果，不输出 API Key、团队密码或完整剧本。没有配置模型 Key 时会在调用模型前安全退出。

### 文件解析边界

- `docx`：优先通过系统 `unzip` 读取 `word/document.xml`；没有 `unzip` 时使用内置 ZIP 解析器
- `doc`：macOS 下通过 `textutil` 转文本；Linux 容器下通过 `antiword`
- `pdf`：优先使用 `pdftotext`；没有时使用 `textutil` 或内置轻量解析器兜底
- 扫描版 PDF 暂不做 OCR，需要先转成可复制文本的 PDF 或 TXT

## 目录

```
SKILL.md                              # 主指令：工作流 + 档案 schema + 输出模板 + 自检
references/
  facs-microexpressions.md            # 16 种情绪的 FACS 肌肉描述词表 + 真假情绪对照
  emotion-body-map.md                 # 16 种情绪 × 姿态/呼吸/手部/眼神 + 内敛型变体
  subtext-externalization.md          # 15 组潜台词外化模式 + 矛盾信号公式
  tension-scenes.md                   # 12 个高频情感场景节拍模板 + 题材变体
  seedance-format.md                  # Seedance B 格式规范 + 无效写法黑名单 + 自检清单
examples/
  example-billionaire-reveal.md       # 完整示例：身份揭露（12 秒）
  example-restrained-breakdown.md     # 完整示例：无对白隐忍崩溃独角戏（12 秒）
index.html                            # 团队网页入口
app.js                                # 前端交互、AI 优先/本地兜底生成
server.js                             # 文件抽取与大模型代理后端
.env.example                          # 环境变量模板
Dockerfile                            # 容器部署入口
vercel.json                           # Vercel Serverless 部署配置
api/[...path].js                      # Vercel API 入口
middleware.js                         # Vercel 入口访问保护
```
