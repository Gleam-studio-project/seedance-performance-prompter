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
```
