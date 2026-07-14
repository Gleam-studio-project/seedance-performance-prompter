# Structured Physical Prompting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将主体优先、动作分层、物理因果和扩展负向约束接入现有 Seedance 表演提示词 Skill，并用自动化契约和固定场景评测验证。

**Architecture:** 保持现有 B 格式和 API 不变。详细知识进入独立 reference，`SKILL.md` 与 `server.js` 只保留核心规则和引用；契约层只硬校验确定性强的固定负向段与显式环境因果，动作层级顺序保留为生成启发式，避免误杀合理的反应镜头。

**Tech Stack:** Markdown Skill/reference、零依赖 Node.js、`node:test`、现有 DeepSeek 评测脚本。

---

### Task 1: 先定义失败契约

**Files:**
- Modify: `tests/prompt-contract.test.js`
- Test: `tests/prompt-contract.test.js`

**Step 1: 写入失败测试**

新增三组断言：新负向模板可通过而旧模板失败；“雨中行走但没有雨水反馈”触发 `physicalCausality`；风吹动头发、雨点击伞溅水等因果描述通过。

**Step 2: 验证测试先失败**

Run: `node --test tests/prompt-contract.test.js`

Expected: FAIL，原因包括新负向段尚未识别、`physicalCausality` 尚不存在。

### Task 2: 实现参考资料与契约

**Files:**
- Create: `references/structured-physical-direction.md`
- Modify: `scripts/lib/prompt-contract.mjs`
- Modify: `tests/prompt-contract.test.js`

**Step 1: 新增结构化动作参考**

写明镜头内顺序、从大到小的动作层级、风/雨/雾/光/接触的原因-结果模板、禁止机械填槽和未经验证的效果宣称。

**Step 2: 更新固定负向模板**

使用统一文案：

```text
负向约束：避免画面抖动、镜头剧烈晃动、人物面部变形、肢体错乱、手指数量异常、画面闪烁、过曝、过暗、字幕、水印和低画质模糊；不要快速切换、戏剧化大动作和生硬切镜。
```

**Step 3: 增加物理因果检查**

只对镜头中明确出现的风、雨、雾、阳光/逆光启用对应反馈词检查，返回 `physicalCausality` 与覆盖指标；未出现这些环境时直接通过。

**Step 4: 验证契约**

Run: `node --test tests/prompt-contract.test.js`

Expected: PASS。

### Task 3: 接入 Skill 与运行时生成

**Files:**
- Modify: `SKILL.md`
- Modify: `references/seedance-format.md`
- Modify: `server.js`
- Modify: `examples/example-billionaire-reveal.md`
- Modify: `examples/example-restrained-breakdown.md`
- Test: `tests/prompt-contract.test.js`

**Step 1: 更新 Skill 路由与模板**

在表演设计引用表中加入新 reference；把主体优先、动作分层、物理反馈和单一运镜写入关键规范与自检清单。

**Step 2: 更新模型硬约束**

在 `handleGeneratePrompt` 中加入同义硬约束，并在 `buildSkillGuide` 中加载新 reference。

**Step 3: 同步格式资料与示例**

替换所有固定负向段；在示例中保持人物先行、环境反馈随后，避免示例与规则分叉。

**Step 4: 添加接线测试**

读取 `SKILL.md`、新 reference 与 `server.js`，断言 reference 已被 Skill 路由和运行时上下文引用。

### Task 4: 全量验证与项目记录

**Files:**
- Modify: `Progress.md`
- Create: `evals/baseline-2026-07-14-structured-physical.md`（仅在真实评测完成时）

**Step 1: 静态与单元验证**

Run: `npm test`

Expected: 全部 PASS。

Run: `npm run check`

Expected: PASS。

Run: `git diff --check`

Expected: PASS。

**Step 2: Skill 结构验证**

Run: `python3 /Users/darius/.codex/skills/.system/skill-creator/scripts/quick_validate.py .`

Expected: Skill frontmatter 与结构有效；若项目目录名导致验证器不适用，记录该限制并手工核对 frontmatter。

**Step 3: 固定场景评测**

Run: `npm run eval`

Expected: 12 个固定场景完成；机器硬门槛不低于原基线 12/12，新增物理因果检查无误报。

**Step 4: 更新进度并提交**

在 `Progress.md` 记录采纳规则、测试、评测结果和未验证的人工质量项；保持生产发布为待授权步骤。
