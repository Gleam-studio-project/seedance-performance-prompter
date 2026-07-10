# Performance Prompt Evals

该目录用于 P1 固定质量评测，回答“真实模型是否稳定生成可直接使用的 Seedance 表演 Prompt”。评测集全部是合成剧情，不包含团队真实剧本。

## 用例结构

`cases.json` 固定包含 12 个场景：欧美 8 个、国内 4 个；覆盖 9/12/15 秒，包含有对白、无对白和长场次拆条。

先验证评测集和脚本，不调用模型：

```bash
npm run eval:check
```

配置模型 Key 后执行完整评测：

```bash
npm run eval
```

只运行单个用例：

```bash
npm run eval -- --case=overseas-hidden-owner
```

报告默认写入 `evals/results/`，该目录已被 Git 忽略。JSON 保存机器检查结果与模型输出；Markdown 用于按 `rubric.md` 人工评分。

## 机器门槛

- 时间戳连续且每条不超过目标时长。
- 一致性锁定段位于负向约束段之前。
- 欧美对白无中文，国内对白使用中文。
- 不出现已知无效参数。
- 至少 90% 镜头同时包含两类以上可观测信号。
- 长场次明确记录第二条拆分对应。

任何机器硬门槛失败都会让命令返回非零退出码。
