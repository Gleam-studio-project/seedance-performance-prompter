const INVALID_PARAMETERS = /(8K|24fps|f\/2\.8|ISO\s*\d+|\bfast\b|电影感参数|参数词)/i;

const signalPatterns = {
  face: /(眉|眼|眼睑|瞳孔|视线|目光|凝视|注视|看向|望向|嘴|唇|鼻翼|下颌|面部|喉结|表情|慢眨眼)/,
  breathVoice: /(呼吸|吸气|吐气|胸腔|胸口|声音|声线|音量|语速|停顿|耳语|鼻音)/,
  bodyProp: /(手|指|肩|背|身体|脚|步|姿态|重心|道具|话筒|杯|门|桌|墙|纸|衣|文件|钥匙|伞|病历|眼镜|笔|戒指|水龙头|手机|手腕)/
};

const physicalCausalityRules = [
  { cause: /(雨|雨水|雨滴)/, effect: /(打在|击中|溅|水花|滴落|滑落|湿|水珠|涟漪|反光)/ },
  { cause: /风/, effect: /(吹|扬|掀|摆|摇|飘|贴|拂|卷)/ },
  { cause: /(雾|水汽)/, effect: /(漫散|凝结|凝在|笼罩|遮挡|显露|模糊|掌痕)/ },
  { cause: /(阳光|逆光|灯光|光线)/, effect: /(透过|投下|照在|落在|反射|映出|光斑|高光|亮斑|轮廓|阴影|漫射|勾勒)/ }
];

export function evaluateProfile(profile) {
  const value = String(profile || "");
  const requiredFields = [
    "人物ID",
    "人物小传",
    "性格底色",
    "关系动力学",
    "贯穿情感弧线",
    "专属表演习惯Tell",
    "核心情绪微表情库"
  ];
  const missingFields = requiredFields.filter((field) => !value.includes(field));
  const checks = {
    nonEmpty: value.trim().length >= 120,
    requiredFields: missingFields.length === 0,
    observableSignals: /(眉|眼睑|嘴|唇|鼻翼|下颌|喉结|呼吸|手|指|肩)/.test(value)
  };
  return buildReport(checks, { chars: value.length, missingFields });
}

export function evaluatePrompt(prompt, options = {}) {
  const value = String(prompt || "").trim();
  const shots = parseShots(value);
  const expectsDialogue = options.expectsDialogue !== false;
  const dialogue = shots.map((shot) => shot.dialogue).filter((line) => line && line !== "无");
  const observableShots = shots.filter((shot) => countSignalCategories(shot.body) >= 2).length;
  const observableCoverage = shots.length ? observableShots / shots.length : 0;
  const physicalReport = evaluatePhysicalCausality(shots);
  const durationSum = Number(shots.reduce((sum, shot) => sum + shot.duration, 0).toFixed(2));

  const checks = {
    hasReferenceHeader: /^@.+?为场景参考[\s\S]*?根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。/m.test(value),
    hasShots: shots.length > 0,
    shotsSequential: shotsAreSequential(shots),
    shotDurationsValid: shots.length > 0 && shots.every((shot) => shot.duration > 0),
    totalDurationWithinLimit: durationSum > 0 && durationSum <= 15,
    hasStyle: /\n风格：.+/m.test(value),
    hasConstraint: /\n约束：.+/m.test(value),
    hasSceneUnderstanding: /\n场景理解：.+/m.test(value),
    hasDesignNote: /\n设计说明：.+/m.test(value),
    dialogueLanguage: dialogueLanguageIsValid(dialogue, options.market, expectsDialogue),
    noInvalidParameters: !INVALID_PARAMETERS.test(value),
    observableCoverage: observableCoverage >= 0.9,
    physicalCausality: physicalReport.pass
  };

  return buildReport(checks, {
    chars: value.length,
    shots: shots.length,
    dialogueLines: dialogue.length,
    observableShots,
    observableCoverage,
    totalDuration: durationSum,
    physicalCausalityShots: physicalReport.causalShots,
    physicalCausalitySatisfied: physicalReport.satisfiedShots,
    physicalCausalityCoverage: physicalReport.coverage
  });
}

export function assertContract(report, label) {
  if (report.pass) return;
  throw new Error(`${label} contract failed: ${report.failedChecks.join(", ")}`);
}

function parseShots(value) {
  const pattern = /分镜(\d+)：([\s\S]*?)(?=\n分镜\d+：|\n风格：|$)/g;
  return [...value.matchAll(pattern)].map((match) => {
    const body = match[2].trim();
    const durationMatch = body.match(/时长：\s*([0-9]+(?:\.[05])?)s/);
    const dialogueMatch = body.match(/台词：\s*([^\n。]+|"[^"]*"|“[^”]*”|无)/);
    return {
      number: Number(match[1]),
      body,
      duration: durationMatch ? Number(durationMatch[1]) : 0,
      dialogue: (dialogueMatch ? dialogueMatch[1] : "").replace(/^台词：/, "").trim()
    };
  });
}

function shotsAreSequential(shots) {
  if (!shots.length) return false;
  for (let i = 0; i < shots.length; i += 1) {
    if (shots[i].number !== i + 1) return false;
    if (!/音效：/.test(shots[i].body)) return false;
    if (!/台词：/.test(shots[i].body)) return false;
    if (!/时长：\s*[0-9]+(?:\.[05])?s/.test(shots[i].body)) return false;
  }
  return true;
}

function dialogueLanguageIsValid(lines, market, expectsDialogue) {
  if (!expectsDialogue) return true;
  if (!lines.length) return false;
  if (market === "domestic") return lines.every((line) => line === "无" || /[\u4e00-\u9fa5]/.test(line));
  return lines.every((line) => line === "无" || !/[\u4e00-\u9fa5]/.test(line));
}

function countSignalCategories(value) {
  return Object.values(signalPatterns).filter((pattern) => pattern.test(value)).length;
}

function evaluatePhysicalCausality(shots) {
  let causalShots = 0;
  let satisfiedShots = 0;

  for (const shot of shots) {
    const activeRules = physicalCausalityRules.filter((rule) => rule.cause.test(shot.body));
    if (!activeRules.length) continue;
    causalShots += 1;
    if (activeRules.every((rule) => rule.effect.test(shot.body))) satisfiedShots += 1;
  }

  const coverage = causalShots ? satisfiedShots / causalShots : 1;
  return { pass: coverage === 1, causalShots, satisfiedShots, coverage };
}

function buildReport(checks, metrics) {
  const failedChecks = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return { pass: failedChecks.length === 0, checks, failedChecks, metrics };
}
