const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const NEGATIVE_CONSTRAINT_LINE = "约束：Alexander先开口，Lily后反应；情绪由强撑转向失衡再被重新压住；全段不增加其他人物；动作自然、口型准确、无穿模、无闪烁，避免画面抖动、镜头剧烈晃动、人物面部变形、肢体错乱、手指数量异常、过曝、过暗、字幕、水印和低画质模糊；不要快速切换、戏剧化大动作和生硬切镜。";

let evaluateProfile;
let evaluatePrompt;
let validateEvalCases;

test.before(async () => {
  ({ evaluateProfile, evaluatePrompt } = await import("../scripts/lib/prompt-contract.mjs"));
  ({ validateEvalCases } = await import("../scripts/lib/eval-cases.mjs"));
});

test("accepts a compliant overseas prompt", () => {
  const report = evaluatePrompt(validPrompt('"I know what you did."', "overseas"), {
    market: "overseas",
    duration: 12,
    expectsDialogue: true,
    expectsSplit: false
  });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.shots, 2);
  assert.equal(report.metrics.observableCoverage, 1);
});

test("rejects language, parameter, and observability violations", () => {
  const prompt = `@婚礼厅（夜） 为场景参考 @Lily 为角色参考 @Alexander 为角色参考。根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。

分镜1：竖屏中近景固定镜头。Lily：她很伤心。宾客站在后面。音效：环境底噪。台词："我知道了"。时长：6s

分镜3：近景固定镜头。Alexander：8K，电影感。宴会灯光照在他身上。音效：无。台词："Stay."。时长：6s

风格：现代情感短剧，冷白宴会厅质感，表演克制。
${NEGATIVE_CONSTRAINT_LINE}
场景理解：这是一场重要冲突。
设计说明：按冲突高点组织。`;
  const report = evaluatePrompt(prompt, { market: "overseas", expectsDialogue: true });
  assert.equal(report.pass, false);
  assert.deepEqual(report.failedChecks.sort(), [
    "dialogueLanguage",
    "noInvalidParameters",
    "observableCoverage",
    "shotsSequential"
  ]);
});

test("requires style constraint understanding and design note sections", () => {
  const prompt = validPrompt('"I know what you did."', "overseas")
    .replace(/\n风格：[\s\S]*$/m, "");
  const report = evaluatePrompt(prompt, { market: "overseas", expectsDialogue: true });
  assert.equal(report.pass, false);
  assert.ok(report.failedChecks.includes("hasStyle"));
  assert.ok(report.failedChecks.includes("hasConstraint"));
  assert.ok(report.failedChecks.includes("hasSceneUnderstanding"));
  assert.ok(report.failedChecks.includes("hasDesignNote"));
});

test("requires visible physical feedback when weather or light causes are explicit", () => {
  const missingFeedback = `@路口（雨夜） 为场景参考 @女主 为角色参考。根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。

分镜1：竖屏中景固定镜头。女主：整体站立微缩肩，头部朝路口偏转，目光越过握伞的左手看向前方，右手握住伞柄。她站在雨中路口。音效：雨声。台词：无。时长：12s

风格：都市情感短剧，冷湿质感，克制表演。
约束：不增加其他人物；动作自然、口型准确、无穿模、无闪烁。
场景理解：她在等待。
设计说明：用停顿承接等待。`;
  const invalidReport = evaluatePrompt(missingFeedback, {
    market: "domestic",
    expectsDialogue: false
  });
  assert.equal(invalidReport.checks.physicalCausality, false);

  const withFeedback = `@路口（雨夜） 为场景参考 @女主 为角色参考。根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。

分镜1：竖屏中景固定镜头。女主：整体站立微缩肩，头部朝路口偏转，目光越过握伞的左手看向前方，右手握住伞柄，拇指擦去下颌的水珠。雨点击中伞面，细小水花沿伞沿溅起，风把湿发贴向她的脸颊。音效：雨声、伞面雨点击打声。台词：无。时长：12s

风格：都市情感短剧，冷湿质感，克制表演。
约束：不增加其他人物；动作自然、口型准确、无穿模、无闪烁。
场景理解：她在等待，心里有事。
设计说明：用雨夜反馈外化压抑。`;
  const validReport = evaluatePrompt(withFeedback, {
    market: "domestic",
    expectsDialogue: false
  });
  assert.equal(validReport.checks.physicalCausality, true);
  assert.equal(validReport.pass, true);
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
  assert.match(server, /场景理解：/);
  assert.match(reference, /主体.*动作.*环境.*镜头.*氛围/);
  assert.match(reference, /整体姿态.*头部.*眼神.*手部.*细节/);
});

test("accepts domestic dialogue and rejects missing profile fields", () => {
  const promptReport = evaluatePrompt(validPrompt('"我一直都知道。"', "domestic"), {
    market: "domestic",
    expectsDialogue: true
  });
  assert.equal(promptReport.pass, true);

  const profileReport = evaluateProfile("人物ID：A\n人物小传：内容不足");
  assert.equal(profileReport.pass, false);
  assert.ok(profileReport.metrics.missingFields.includes("关系动力学"));
});

test("counts gaze plus body movement as two observable signal categories", () => {
  const prompt = `@室内（夜） 为场景参考 @她 为角色参考。根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。

分镜1：竖屏近景固定镜头。她：整体站立不动，头部略低，视线低垂到握住门把的左手，指节缓慢松开，嘴唇压住呼吸。门边墙面保持暗色静止。音效：门把轻响。台词：无。时长：4s

分镜2：竖屏近景固定镜头。她：整体肩膀下沉，头部停住不转，目光固定在杯中的水纹上，拇指擦过杯壁，胸口起伏一次。桌前只有台灯与杯面反光。音效：轻微呼气、杯壁摩擦声。台词：无。时长：8s

风格：现代情感短剧，写实近距质感，表演克制。
约束：不增加其他人物；动作自然、口型准确、无穿模、无闪烁。
场景理解：她在压回将要出口的话。
设计说明：用视线与手部泄漏冲突。`;
  const report = evaluatePrompt(prompt, { market: "overseas", expectsDialogue: false });
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

function validPrompt(dialogue, market = "overseas") {
  const spoken = market === "domestic" ? dialogue : dialogue;
  return `@婚礼贵宾厅（室内夜景） 为场景参考 @Lily 为角色参考 @Alexander 为角色参考。根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。

分镜1：竖屏中近景固定镜头，35mm，浅景深。Lily：整体站姿勉强挺直，重心锁在脚跟；头部几乎不动；目光停在Marcus手里的话筒上，眼角没有跟上嘴角的礼貌弧度；左手抓住右手手腕，指节一点点发白；慢眨眼一次，把吸气压回胸口。宴会厅宾客虚化站在她身后，顶灯冷白。音效：宾客窃笑、布料摩擦、短促吸气。台词：无。时长：4s

分镜2：竖屏中近景固定镜头，50mm，浅景深。Alexander：整体从人群阴影中稳定前出，肩线平稳；头部先偏向Marcus再转向全场；目光压住全场，表情中性，喉结滚动一次后开口；右手接过话筒，拇指沿话筒柄轻微收紧；说完后嘴唇自然闭合，不追加动作。宴会厅灯光落在话筒金属边缘，形成一线窄高光。音效：脚步止住、话筒轻碰声、宴会厅空调底噪。台词：${spoken}。时长：8s

风格：豪门羞辱反击题材，现代宴会厅写实质感，表演克制但压迫感明确。
${NEGATIVE_CONSTRAINT_LINE}
场景理解：这是公开羞辱后的反击起点，前面是Marcus持续压低Lily，后面会把权力关系迅速翻转。Lily此刻仍在强撑体面，Alexander与她的关系温度已带保护意味但未完全摊开，Marcus仍以为自己掌控局面。
设计说明：用先压后出手的两段节拍，把体面裂缝与权力翻转落到可观测动作上。`;
}

test("server prompt contract mentions scene understanding and new format", async () => {
  const server = await readFile(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /场景理解：/);
  assert.match(server, /分镜1：/);
  assert.match(server, /时长：Xs/);
});

test("profile prompt explicitly forbids JSON and nested braces", async () => {
  const server = await readFile(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /严禁输出 JSON/);
  assert.match(server, /花括号/);
  assert.match(server, /关系动力学必须写成纯中文可读文本/);
});
