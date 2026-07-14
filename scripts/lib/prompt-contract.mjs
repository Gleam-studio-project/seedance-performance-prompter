const CONSISTENCY_LOCK = "一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。";
const NEGATIVE_CONSTRAINT = "负向约束：避免画面抖动、镜头剧烈晃动、人物面部变形、肢体错乱、手指数量异常、画面闪烁、过曝、过暗、字幕、水印和低画质模糊；不要快速切换、戏剧化大动作和生硬切镜。";
const INVALID_PARAMETERS = /(8K|24fps|f\/2\.8|ISO\s*\d+|\bfast\b)/i;

const signalPatterns = {
  face: /(眉|眼|眼睑|瞳孔|视线|目光|嘴|唇|鼻翼|下颌|面部|喉结)/,
  breathVoice: /(呼吸|吸气|吐气|胸腔|胸口|声音|声线|音量|语速|停顿)/,
  bodyProp: /(手|指|肩|背|身体|脚|步|姿态|重心|道具|话筒|杯|门|桌|墙|纸|衣|文件|钥匙|伞|病历|眼镜|笔|戒指|水龙头|手机)/
};

const physicalCausalityRules = [
  { cause: /(雨|雨水|雨滴)/, effect: /(打在|击中|溅|水花|滴落|滑落|湿|水珠|涟漪|反光)/ },
  { cause: /(风|气流)/, effect: /(吹|扬|掀|摆|摇|飘|贴|拂|卷)/ },
  { cause: /(雾|水汽)/, effect: /(漫散|凝结|凝在|笼罩|遮挡|显露|模糊|掌痕)/ },
  { cause: /(阳光|逆光|灯光|光线)/, effect: /(透过|投下|照在|落在|反射|映出|光斑|轮廓|阴影|漫射|勾勒)/ }
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
  const value = String(prompt || "");
  const shots = parseShots(value);
  const duration = Number(options.duration || 12);
  const expectsDialogue = options.expectsDialogue !== false;
  const dialogue = [...value.matchAll(/对话：[“"]([^”"]+)[”"]/g)].map((match) => match[1]);
  const observableShots = shots.filter((shot) => countSignalCategories(shot.body) >= 2).length;
  const observableCoverage = shots.length ? observableShots / shots.length : 0;
  const physicalReport = evaluatePhysicalCausality(shots);
  const consistencyIndex = value.lastIndexOf(CONSISTENCY_LOCK);
  const negativeIndex = value.lastIndexOf(NEGATIVE_CONSTRAINT);

  const checks = {
    hasShots: shots.length > 0,
    timestampsContinuous: timestampsAreContinuous(shots),
    durationWithinLimit: shots.length > 0 && shots.every((shot) => shot.end <= duration),
    fixedEndingOrder: consistencyIndex >= 0 && negativeIndex > consistencyIndex,
    dialogueLanguage: dialogueLanguageIsValid(dialogue, options.market, expectsDialogue),
    noInvalidParameters: !INVALID_PARAMETERS.test(value),
    observableCoverage: observableCoverage >= 0.9,
    physicalCausality: physicalReport.pass,
    splitDocumented: !options.expectsSplit || /拆条对应[\s\S]*(条\s*2|条2|第二条|拆成\s*2|2\s*条)/.test(value)
  };

  return buildReport(checks, {
    chars: value.length,
    shots: shots.length,
    dialogueLines: dialogue.length,
    observableShots,
    observableCoverage,
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
  const pattern = /镜头\s+(\d+)\s*\(\s*(\d+)\s*[–—-]\s*(\d+)\s*秒\s*\)：([\s\S]*?)(?=\n\s*镜头\s+\d+|\n\s*一致性锁定：|\n\s*负向约束：|$)/g;
  return [...value.matchAll(pattern)].map((match) => ({
    number: Number(match[1]),
    start: Number(match[2]),
    end: Number(match[3]),
    body: match[4].trim()
  }));
}

function timestampsAreContinuous(shots) {
  if (!shots.length) return false;
  let previousEnd = null;
  let previousNumber = null;
  for (const shot of shots) {
    if (shot.end <= shot.start) return false;
    if (shot.start === 0) {
      previousEnd = null;
      previousNumber = null;
    }
    if (previousEnd !== null && shot.start !== previousEnd) return false;
    if (previousNumber !== null && shot.number !== previousNumber + 1) return false;
    previousEnd = shot.end;
    previousNumber = shot.number;
  }
  return true;
}

function dialogueLanguageIsValid(lines, market, expectsDialogue) {
  if (!expectsDialogue) return true;
  if (!lines.length) return false;
  if (market === "domestic") return lines.every((line) => /[\u4e00-\u9fa5]/.test(line));
  return lines.every((line) => !/[\u4e00-\u9fa5]/.test(line));
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
