const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const LEGACY_NEGATIVE_CONSTRAINT = "负向约束：不要字幕、水印和夸张表情；不要生硬切镜；避免抖动和剧烈动作。";
const NEGATIVE_CONSTRAINT = "负向约束：避免画面抖动、镜头剧烈晃动、人物面部变形、肢体错乱、手指数量异常、画面闪烁、过曝、过暗、字幕、水印和低画质模糊；不要快速切换、戏剧化大动作和生硬切镜。";

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
  const prompt = `镜头 1 (0–4秒)：\n她很伤心。\n对话："我知道了。"\n\n镜头 2 (6–12秒)：\n8K，电影感。\n\n一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。\n\n${NEGATIVE_CONSTRAINT}`;
  const report = evaluatePrompt(prompt, { market: "overseas", duration: 12, expectsDialogue: true });
  assert.equal(report.pass, false);
  assert.deepEqual(report.failedChecks.sort(), [
    "dialogueLanguage",
    "noInvalidParameters",
    "observableCoverage",
    "timestampsContinuous"
  ]);
});

test("rejects the legacy negative constraint template", () => {
  const prompt = validPrompt('"I know what you did."').replace(NEGATIVE_CONSTRAINT, LEGACY_NEGATIVE_CONSTRAINT);
  const report = evaluatePrompt(prompt, {
    market: "overseas",
    duration: 12,
    expectsDialogue: true
  });
  assert.equal(report.pass, false);
  assert.ok(report.failedChecks.includes("fixedEndingOrder"));
});

test("requires visible physical feedback when weather or light causes are explicit", () => {
  const missingFeedback = `镜头 1 (0–12秒)：
女主在雨中向前走，肩膀微微内收，目光越过握伞的左手看向路口。

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

${NEGATIVE_CONSTRAINT}`;
  const invalidReport = evaluatePrompt(missingFeedback, {
    market: "domestic",
    duration: 12,
    expectsDialogue: false
  });
  assert.equal(invalidReport.checks.physicalCausality, false);
  assert.ok(invalidReport.failedChecks.includes("physicalCausality"));

  const withFeedback = `镜头 1 (0–12秒)：
女主肩膀微微内收，目光越过握伞的左手看向路口。雨点击中伞面，细小水花沿伞沿溅起；风把湿发贴向她的脸颊，她用拇指擦去下颌的水珠。

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

${NEGATIVE_CONSTRAINT}`;
  const validReport = evaluatePrompt(withFeedback, {
    market: "domestic",
    duration: 12,
    expectsDialogue: false
  });
  assert.equal(validReport.checks.physicalCausality, true);
  assert.equal(validReport.pass, true);

  const breathingAirflow = evaluatePrompt(silentPrompt(
    "她双肩缓慢下沉，目光盯着杯沿，右手握住左手手腕；嘴唇张开但没有声音，只有呼气和吸气的气流声。"
  ), { market: "domestic", duration: 12, expectsDialogue: false });
  assert.equal(breathingAirflow.checks.physicalCausality, true);
  assert.equal(breathingAirflow.checks.observableCoverage, true);

  const practicalLight = evaluatePrompt(silentPrompt(
    "她侧身坐在桌前，目光停在戒指上，左手食指压住纸张。台灯光线落在戒指表面，形成一道窄高光。"
  ), { market: "domestic", duration: 12, expectsDialogue: false });
  assert.equal(practicalLight.checks.physicalCausality, true);
  assert.equal(practicalLight.pass, true);
});

test("skill and runtime load the structured physical direction reference", async () => {
  const root = path.join(__dirname, "..");
  const [skill, server, reference] = await Promise.all([
    readFile(path.join(root, "SKILL.md"), "utf8"),
    readFile(path.join(root, "server.js"), "utf8"),
    readFile(path.join(root, "references", "structured-physical-direction.md"), "utf8")
  ]);
  assert.match(skill, /structured-physical-direction\.md/);
  assert.match(server, /structured-physical-direction\.md/);
  assert.match(server, /最后一个镜头的结束秒必须等于/);
  assert.match(reference, /主体.*动作.*环境.*镜头.*氛围/);
  assert.match(reference, /整体姿态.*头部.*眼神.*手部.*细节/);
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

test("counts gaze plus body movement as two observable signal categories", () => {
  const prompt = `镜头 1 (0–4秒)：
她的视线低垂到握住门把的左手，指节缓慢松开。

镜头 2 (4–12秒)：
目光固定在杯中的水纹上，肩膀下沉，拇指擦过杯壁。

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

${NEGATIVE_CONSTRAINT}`;
  const report = evaluatePrompt(prompt, { market: "overseas", duration: 12, expectsDialogue: false });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.observableCoverage, 1);
});

test("counts clothing and paper as observable prop interaction", () => {
  const prompt = `镜头 1 (0–4秒)：
目光从叠好的衣物移向柜门，掌心压平衬衫的折痕。

镜头 2 (4–12秒)：
视线扫过纸条上的字迹，下眼睑收紧；纸张边缘在展开时轻微抖动。

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

${NEGATIVE_CONSTRAINT}`;
  const report = evaluatePrompt(prompt, { market: "domestic", duration: 12, expectsDialogue: false });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.observableCoverage, 1);
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

${NEGATIVE_CONSTRAINT}`;
}

function silentPrompt(body) {
  return `镜头 1 (0–12秒)：
${body}

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

${NEGATIVE_CONSTRAINT}`;
}
