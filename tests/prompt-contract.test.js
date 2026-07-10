const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

let evaluateProfile;
let evaluatePrompt;
let validateEvalCases;

test.before(async () => {
  ({ evaluateProfile, evaluatePrompt } = await import("../scripts/lib/prompt-contract.mjs"));
  ({ validateEvalCases } = await import("../scripts/lib/eval-cases.mjs"));
});

test("accepts a compliant overseas prompt", () => {
  const report = evaluatePrompt(validPrompt('"I know what you did."'), {
    market: "overseas",
    duration: 12,
    expectsDialogue: true,
    expectsSplit: false
  });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.shots, 2);
  assert.equal(report.metrics.observableCoverage, 1);
});

test("rejects language, timestamp, parameter, and observability violations", () => {
  const prompt = `镜头 1 (0–4秒)：\n她很伤心。\n对话："我知道了。"\n\n镜头 2 (6–12秒)：\n8K，电影感。\n\n一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。\n\n负向约束：不要字幕、水印和夸张表情；不要生硬切镜；避免抖动和剧烈动作。`;
  const report = evaluatePrompt(prompt, { market: "overseas", duration: 12, expectsDialogue: true });
  assert.equal(report.pass, false);
  assert.deepEqual(report.failedChecks.sort(), [
    "dialogueLanguage",
    "noInvalidParameters",
    "observableCoverage",
    "timestampsContinuous"
  ]);
});

test("accepts reset timestamps when a long scene documents a second strip", () => {
  const prompt = `${validPrompt('"Stay."')}\n\n镜头 1 (0–4秒)：\n眼睑收紧，呼吸变浅，手指按住门把。\n对话："I can't." 语速放慢，音量很低。\n\n镜头 2 (4–12秒)：\n目光转向桌上的钥匙，胸口起伏一次，肩膀缓慢下沉。\n\n拆条对应：条1对应争辩；条2对应归还钥匙和告别。`;
  const report = evaluatePrompt(prompt, { market: "overseas", duration: 12, expectsDialogue: true, expectsSplit: true });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.shots, 4);
});

test("accepts domestic dialogue and rejects missing profile fields", () => {
  const promptReport = evaluatePrompt(validPrompt('"我一直都知道。"'), {
    market: "domestic",
    duration: 12,
    expectsDialogue: true
  });
  assert.equal(promptReport.pass, true);

  const profileReport = evaluateProfile("人物ID：A\n人物小传：内容不足");
  assert.equal(profileReport.pass, false);
  assert.ok(profileReport.metrics.missingFields.includes("关系动力学"));
});

test("eval dataset satisfies the fixed P1 distribution", async () => {
  const cases = JSON.parse(await readFile(path.join(__dirname, "..", "evals", "cases.json"), "utf8"));
  const report = validateEvalCases(cases);
  assert.equal(report.pass, true, report.errors.join("\n"));
  assert.deepEqual(report.summary, {
    total: 12,
    overseas: 8,
    domestic: 4,
    dialogue: 10,
    silent: 2,
    split: 2,
    durations: { 9: 3, 12: 5, 15: 4 }
  });
});

function validPrompt(dialogue) {
  return `镜头 1 (0–4秒)：
眼睑轻微收紧，目光停在对方手上；吸气变浅，右手拇指摩擦食指。
对话：${dialogue} 语速放慢，音量很低，开口前停顿0.5秒。

镜头 2 (4–12秒)：
嘴唇压平后松开，呼吸从胸口缓慢落下；肩膀下沉，手掌离开桌沿。

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

负向约束：不要字幕、水印和夸张表情；不要生硬切镜；避免抖动和剧烈动作。`;
}
