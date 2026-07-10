const STORAGE_KEY = "performance-prompter-workbench";
const MODEL_KEY_STORAGE = `${STORAGE_KEY}:model-key`;
const AUTH_STORAGE = `${STORAGE_KEY}:auth`;
const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:4174" : "";

const els = {
  projectName: document.querySelector("#projectName"),
  marketSelect: document.querySelector("#marketSelect"),
  aiStatus: document.querySelector("#aiStatus"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  scriptInput: document.querySelector("#scriptInput"),
  fileDropZone: document.querySelector("#fileDropZone"),
  scriptFileInput: document.querySelector("#scriptFileInput"),
  fileStatus: document.querySelector("#fileStatus"),
  sampleBtn: document.querySelector("#sampleBtn"),
  extractProfileBtn: document.querySelector("#extractProfileBtn"),
  selectionCount: document.querySelector("#selectionCount"),
  profileInput: document.querySelector("#profileInput"),
  profileState: document.querySelector("#profileState"),
  aiProfileBtn: document.querySelector("#aiProfileBtn"),
  confirmProfileBtn: document.querySelector("#confirmProfileBtn"),
  resetProfileBtn: document.querySelector("#resetProfileBtn"),
  tuningLog: document.querySelector("#tuningLog"),
  tuningForm: document.querySelector("#tuningForm"),
  tuningInput: document.querySelector("#tuningInput"),
  modelInput: document.querySelector("#modelInput"),
  modelOptions: document.querySelector("#modelOptions"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveModelBtn: document.querySelector("#saveModelBtn"),
  sceneTypeSelect: document.querySelector("#sceneTypeSelect"),
  durationSelect: document.querySelector("#durationSelect"),
  generateBtn: document.querySelector("#generateBtn"),
  localGenerateBtn: document.querySelector("#localGenerateBtn"),
  promptOutput: document.querySelector("#promptOutput"),
  promptQuality: document.querySelector("#promptQuality"),
  copyPromptBtn: document.querySelector("#copyPromptBtn"),
  downloadPromptBtn: document.querySelector("#downloadPromptBtn"),
  checkList: document.querySelector("#checkList"),
  toast: document.querySelector("#toast"),
  authOverlay: document.querySelector("#authOverlay"),
  authForm: document.querySelector("#authForm"),
  authUser: document.querySelector("#authUser"),
  authPassword: document.querySelector("#authPassword"),
  authError: document.querySelector("#authError")
};

const sampleScript = `项目：Hidden Vows
目标市场：欧美竖屏短剧，英文对白

主要人物：
Lily Carter，29岁，花艺师。前夫长期贬低她，她习惯用礼貌微笑遮住受伤。
Alexander Vance，35岁，科技公司CEO，三年前隐藏身份接近普通生活。沉默、控制型，保护欲强。
Marcus Hale，33岁，Lily 的前夫，虚荣，喜欢在公开场合羞辱别人。

场景：前夫婚礼贵宾厅。Marcus 当众宣布 Lily 是“连婚纱都是借的可怜虫”。宾客窃笑。Lily 仍然笑着，但左手抓住右手手腕。Alexander 从宾客阴影里走出来，拿过话筒，沉默后看向全场。

对白：
Marcus: "She always wanted a fairytale. Too bad she could only afford a borrowed dress."
Alexander: "I own this building. And the one next to it."
Lily does not speak. She only blinks once, slower than normal.`;

const scenePatterns = {
  reveal: ["身份", "揭露", "真相", "CEO", "own", "building", "继承", "大佬", "复仇"],
  argument: ["争吵", "吵", "质问", "背叛", "get out", "你以为", "What did you", "摔"],
  confession: ["告白", "love you", "喜欢", "一直", "I always have", "不必回答"],
  breakdown: ["崩溃", "哭", "无声", "厨房", "水槽", "泪", "撑住"],
  reunion: ["重逢", "多年", "Long time no see", "咖啡", "偶遇"],
  farewell: ["离婚", "诀别", "goodbye", "协议", "sign it", "分手"],
  close: ["靠近", "壁咚", "耳畔", "feel this", "墙", "门边"],
  guard: ["病床", "医院", "受伤", "昏睡", "leave me", "守护"]
};

const sceneTemplates = {
  reveal: {
    title: "身份揭露",
    conflict: "A 要让对方看清真相，但必须把澎湃情绪压进平静动作里。",
    beats: [
      "抬起一直低垂的眼帘，目光从谦卑切换到锋利；姿态从微蜷转为双肩后展，脊椎挺直。",
      "轻吸一口气，目光平稳扫视在场每一个人；用低两度的声线说对白，每次词尾留出细小空拍。",
      "话毕全身静止，只有胸口呼吸起伏可见，凝视对方直到对方先退却。"
    ]
  },
  argument: {
    title: "争吵爆发",
    conflict: "A 要把被压住的话砸回去，但最后仍要守住自尊。",
    beats: [
      "动作突然停止，后背微弓；嘴唇动了两次但没发出声，眼白露出度增加。",
      "声音从正常拉高，咬字变快变碎；手掌拍向桌面或墙面，手臂前伸时肩胛骨耸起。",
      "骤然收声，胸腔剧烈起伏；声音降到筋疲力尽，语尾破裂。"
    ]
  },
  confession: {
    title: "克制告白",
    conflict: "A 要说出最重的话，但又给对方留下退路。",
    beats: [
      "低下目光沉默，喉结动一次；抬头时眼眶微红但无泪，声音压到微气声。",
      "立即轻吸气，用一个没有到达眼睛的自嘲笑遮住脆弱；身体后撤半步。",
      "微笑变软，转身前停一拍；拉门或放下物件的动作缓慢。"
    ]
  },
  breakdown: {
    title: "隐忍崩溃",
    conflict: "A 要确认无人看见，才让身体做嘴巴不允许做的事。",
    beats: [
      "背抵关闭的门或水槽边缘，手指缓慢滑落；肩膀完成一次深吸再缓慢下沉。",
      "喉结上提后下降，眼睑压住泪光；手掌根部压住嘴，张口却没有声音。",
      "泪水滑落后用手背粗糙擦掉；肩膀大幅起伏两次，重新站直。"
    ]
  },
  reunion: {
    title: "重逢",
    conflict: "A 要确认对方不是幻觉，又必须藏住还没死掉的感情。",
    beats: [
      "手里的动作悬在半空，全身僵直；瞳孔先放大再缩小，嘴唇无声开合。",
      "先低头看杯子或地板，再抬头用礼貌微笑盖住一切；空着的手插进口袋防颤。",
      "说要离开但脚没有动；最后一次真目光接触只持续半秒。"
    ]
  },
  farewell: {
    title: "诀别",
    conflict: "A 要把关系结束说出口，但每一个道具动作都泄漏痛感。",
    beats: [
      "把文件、戒指或钥匙推向对方；撤回手并十指交叉，建立正式距离。",
      "看到对方表情变化，嘴角先下撇又立刻拉平；放下笔帽或物件时手指微顿。",
      "走到门边背对对方，肩膀吸一口气再吐出；只给半张脸说告别。"
    ]
  },
  close: {
    title: "危险靠近",
    conflict: "A 要用极近距离逼对方承认，但用不触碰制造张力。",
    beats: [
      "单手平稳撑在墙边，身体前倾到二十厘米内；目光从眼睛滑到嘴唇再回到眼睛。",
      "嘴唇靠近耳畔三厘米但不碰；声音降到胸腔低音区，对方肩颈轻微一缩。",
      "撤后半寸注视瞳孔；拇指极轻擦过下唇线后退开。"
    ]
  },
  guard: {
    title: "病床守护",
    conflict: "A 要用安静陪伴盖过所有未说的话，同时把脆弱藏好。",
    beats: [
      "坐在床沿握住对方的手，拇指在手背上无意识画圈；眼眶微红但不流泪。",
      "对方手动一下，画圈动作立刻停止；身体前倾探温后又退回。",
      "俯身在眉心停留数秒，低声说一句不能承受失去的话；手背出现一滴泪水。"
    ]
  },
  auto: {
    title: "情感对手戏",
    conflict: "A 要推进核心冲突，但真实意图通过微动作和呼吸泄漏。",
    beats: [
      "身体先静止，眼神锁定对方；嘴唇微张后又闭合，把第一反应压回去。",
      "手部与道具发生小幅互动，指节、虎口或衣料泄漏张力；语速和呼吸出现轻微错位。",
      "对白落下后不急着动作，留出一秒沉默；只用眼神和胸口起伏收束。"
    ]
  }
};

const emotionLibrary = {
  restrainedAnger: {
    face: "眉毛压低至几乎遮住上眼睑，眉心轻微折起。下眼睑轻微上提。嘴角横向绷紧不抬高，下颌的咬肌在0.3秒内滑动一次。",
    body: "身体完全静止，足跟死死踏入地面。双手互相按压到指背皮肤泛白。"
  },
  restrainedSadness: {
    face: "眉毛用力压低并向眉心靠拢，下眼睑向上拉紧，几乎挤出泪光但被强行压住。嘴唇压成一条白线，喉结上下滚动一次。",
    body: "脊柱挺直但肩部锁死，胸腔几乎不动，偶尔一次深呼吸暴露情绪。"
  },
  attraction: {
    face: "下眼睑轻微上提，嘴角极轻微向上提起但不露齿。眨眼速度变慢，闭眼阶段延长至0.4秒。",
    body: "身体无意识朝向对方，重心微微前移；视线在对方唇部和眼睛间缓慢移动。"
  },
  shock: {
    face: "整条眉毛上抬形成水平额纹，上眼睑大幅上提。下颌快速下垂，嘴唇张开呈O形，0.3秒后缓慢合拢。",
    body: "全身短暂冻结0.3秒，手部动作停在半空，屏住呼吸后快速吸气。"
  },
  contempt: {
    face: "一侧嘴角向侧上方轻微提起，同侧眉毛轻微上扬，整个表情在0.3秒内完成。",
    body: "身体稍微后靠，下巴上抬，视线从上往下扫视，呼吸里带一声短促鼻哼。"
  },
  controlledCalm: {
    face: "面部肌肉维持中立，嘴唇横向绷紧为一条直线，下眼睑轻微上提，眨眼明显减少。",
    body: "呼吸节奏被刻意控制，双肩稳定不动，手指只在道具边缘出现一次极小幅摩擦。"
  }
};

let state = {
  aiConfigured: false,
  modelConfig: {
    model: "",
    baseUrl: ""
  },
  modelCapabilities: {
    allowModelConfig: false,
    allowBaseUrl: false,
    allowApiKey: false,
    modelOptions: []
  },
  profileConfirmed: false,
  tuning: [
    {
      role: "ai",
      text: "默认使用 performance-prompter：可观测微动作、B 格式、英文对白优先、动作幅度克制。你可以在这里继续调教整体偏好。"
    }
  ]
};

async function requestJson(url, options = {}) {
  const authToken = sessionStorage.getItem(AUTH_STORAGE);
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(authToken ? { authorization: `Basic ${authToken}` } : {}),
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" })
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      showAuthOverlay(authToken ? "用户名或密码不正确" : "");
      throw new Error("需要团队访问密码");
    }
    throw new Error(payload.error || response.statusText || "请求失败");
  }
  return payload;
}

function showAuthOverlay(message = "") {
  els.authOverlay.hidden = false;
  els.authError.textContent = message;
  window.setTimeout(() => els.authPassword.focus(), 0);
}

function hideAuthOverlay() {
  els.authOverlay.hidden = true;
  els.authError.textContent = "";
}

async function refreshAiStatus() {
  try {
    const status = await requestJson("/api/status");
    hideAuthOverlay();
    applyModelStatus(status);
    els.aiStatus.classList.toggle("is-ok", state.aiConfigured);
    els.generateBtn.disabled = false;
    els.aiProfileBtn.disabled = false;
  } catch {
    state.aiConfigured = false;
    els.aiStatus.textContent = location.protocol === "file:" ? "需启动服务" : "待登录";
    els.aiStatus.classList.remove("is-ok");
  }
}

function applyModelStatus(status) {
  const modelConfig = status.modelConfig || {};
  state.modelCapabilities = {
    allowModelConfig: Boolean(modelConfig.allowModelConfig),
    allowBaseUrl: Boolean(modelConfig.allowBaseUrl),
    allowApiKey: Boolean(modelConfig.allowApiKey),
    modelOptions: Array.isArray(modelConfig.modelOptions) ? modelConfig.modelOptions : []
  };

  renderModelControls(status);
  const hasClientKey = state.modelCapabilities.allowApiKey && Boolean(els.apiKeyInput.value.trim());
  state.aiConfigured = Boolean(status.aiConfigured) || hasClientKey;
  const activeModel = els.modelInput.value.trim() || status.model || "已接入";
  els.aiStatus.textContent = state.aiConfigured
    ? activeModel
    : state.modelCapabilities.allowApiKey
      ? "待填 Key"
      : "未配置";
}

function renderModelControls(status = {}) {
  const modelConfig = status.modelConfig || {};
  const options = state.modelCapabilities.modelOptions.length
    ? state.modelCapabilities.modelOptions
    : [status.model].filter(Boolean);

  els.modelOptions.innerHTML = "";
  options.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    els.modelOptions.append(option);
  });

  if (!els.modelInput.value.trim()) {
    els.modelInput.value = state.modelConfig.model || modelConfig.model || status.model || "";
  }
  if (!els.baseUrlInput.value.trim() && state.modelCapabilities.allowBaseUrl) {
    els.baseUrlInput.value = state.modelConfig.baseUrl || modelConfig.baseUrl || "";
  }
  els.apiKeyInput.value = sessionStorage.getItem(MODEL_KEY_STORAGE) || els.apiKeyInput.value;

  els.modelInput.disabled = !state.modelCapabilities.allowModelConfig;
  els.baseUrlInput.disabled = !state.modelCapabilities.allowBaseUrl;
  els.apiKeyInput.disabled = !state.modelCapabilities.allowApiKey;
  els.saveModelBtn.disabled = !(
    state.modelCapabilities.allowModelConfig ||
    state.modelCapabilities.allowBaseUrl ||
    state.modelCapabilities.allowApiKey
  );

  els.modelInput.placeholder = modelConfig.model || status.model || "gpt-4.1";
  els.baseUrlInput.placeholder = state.modelCapabilities.allowBaseUrl ? "https://api.openai.com/v1" : "服务端固定";
  els.apiKeyInput.placeholder = state.modelCapabilities.allowApiKey ? "可填个人 Key" : "使用服务端 Key";
}

function getModelConfigForRequest() {
  syncModelConfigFromInputs(false);
  return {
    model: els.modelInput.value.trim(),
    baseUrl: els.baseUrlInput.disabled ? "" : els.baseUrlInput.value.trim(),
    apiKey: els.apiKeyInput.disabled ? "" : els.apiKeyInput.value.trim()
  };
}

function syncModelConfigFromInputs(persistKey) {
  state.modelConfig = {
    model: els.modelInput.value.trim(),
    baseUrl: els.baseUrlInput.disabled ? "" : els.baseUrlInput.value.trim()
  };
  if (persistKey && !els.apiKeyInput.disabled) {
    const key = els.apiKeyInput.value.trim();
    if (key) sessionStorage.setItem(MODEL_KEY_STORAGE, key);
    else sessionStorage.removeItem(MODEL_KEY_STORAGE);
  }
  saveState(false);
}

function saveModelSettings(showMessage = true) {
  syncModelConfigFromInputs(true);
  if (showMessage) showToast("模型设置已保存");
  refreshAiStatus();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state = { ...state, ...saved.state };
    els.projectName.value = saved.projectName || "未命名项目";
    els.marketSelect.value = saved.market || "overseas";
    els.scriptInput.value = saved.script || "";
    els.profileInput.value = saved.profile || "";
    els.promptOutput.value = saved.prompt || "";
    els.modelInput.value = state.modelConfig?.model || "";
    els.baseUrlInput.value = state.modelConfig?.baseUrl || "";
    els.apiKeyInput.value = sessionStorage.getItem(MODEL_KEY_STORAGE) || "";
  } catch (error) {
    console.warn("Could not load saved project", error);
  }
}

function saveState(showMessage = true) {
  const payload = {
    projectName: els.projectName.value.trim() || "未命名项目",
    market: els.marketSelect.value,
    script: els.scriptInput.value,
    profile: els.profileInput.value,
    prompt: els.promptOutput.value,
    state
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (showMessage) showToast("已保存到本机浏览器");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function updateProfileState() {
  els.profileState.textContent = state.profileConfirmed ? "已确认" : "待确认";
  els.profileState.classList.toggle("is-ok", state.profileConfirmed);
  els.profileState.classList.toggle("is-warn", !state.profileConfirmed);
}

function setBusy(element, isBusy, busyText) {
  if (!element) return () => {};
  const previousText = element.textContent;
  element.disabled = isBusy;
  if (isBusy && busyText) element.textContent = busyText;
  return () => {
    element.disabled = false;
    element.textContent = previousText;
  };
}

function getSelection() {
  const start = els.scriptInput.selectionStart;
  const end = els.scriptInput.selectionEnd;
  return els.scriptInput.value.slice(start, end).trim();
}

function updateSelectionCount() {
  const selected = getSelection();
  els.selectionCount.textContent = selected ? `${selected.length} 字已选择` : "未选择剧情";
}

function addMessage(role, text) {
  state.tuning.push({ role, text });
  renderTuningLog();
  saveState(false);
}

function renderTuningLog() {
  els.tuningLog.innerHTML = "";
  state.tuning.forEach((message) => {
    const item = document.createElement("div");
    item.className = `message ${message.role === "user" ? "user" : "ai"}`;
    const label = document.createElement("strong");
    label.textContent = message.role === "user" ? "你" : "AI 调教器";
    const text = document.createElement("span");
    text.textContent = message.text;
    item.append(label, text);
    els.tuningLog.append(item);
  });
  els.tuningLog.scrollTop = els.tuningLog.scrollHeight;
}

function extractCharacters(script) {
  const names = new Set();
  const colonMatches = script.matchAll(/(^|\n)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z ._-]{1,28})[:：]/g);
  for (const match of colonMatches) {
    const name = match[2].trim();
    if (!["项目", "目标市场", "主要人物", "场景", "对白"].includes(name)) names.add(name);
  }

  const listedMatches = script.matchAll(/([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}|[\u4e00-\u9fa5]{2,4})[，,]\s*(\d{2}岁|[A-Za-z\u4e00-\u9fa5 ]{2,16})/g);
  for (const match of listedMatches) {
    names.add(match[1].trim());
  }

  return [...names].slice(0, 5);
}

function detectScene(text) {
  const selected = els.sceneTypeSelect.value;
  if (selected !== "auto") return selected;
  const score = {};
  Object.entries(scenePatterns).forEach(([type, words]) => {
    score[type] = words.reduce((sum, word) => sum + (text.toLowerCase().includes(word.toLowerCase()) ? 1 : 0), 0);
  });
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "auto";
}

function inferEmotion(text) {
  const lower = text.toLowerCase();
  if (/怒|质问|背叛|get out|dare|say that/.test(lower)) return emotionLibrary.restrainedAnger;
  if (/哭|泪|崩溃|goodbye|离婚|分手|borrowed dress|羞辱/.test(lower)) return emotionLibrary.restrainedSadness;
  if (/love|喜欢|告白|靠近|唇|耳畔|feel this/.test(lower)) return emotionLibrary.attraction;
  if (/身份|揭露|真相|own this building|惊|僵住/.test(lower)) return emotionLibrary.shock;
  if (/嘲|轻蔑|可怜虫|perfect together|wonderful/.test(lower)) return emotionLibrary.contempt;
  return emotionLibrary.controlledCalm;
}

function extractDialogue(text, market) {
  const quoteMatches = [...text.matchAll(/["“]([^"”]{2,160})["”]/g)].map((match) => match[1].trim());
  const colonLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /[:：]/.test(line))
    .map((line) => line.split(/[:：]/).slice(1).join(":").trim())
    .filter((line) => line.length > 1 && line.length < 180);
  const raw = [...new Set([...quoteMatches, ...colonLines].filter(Boolean))];
  if (raw.length) {
    const normalized = raw.map((line) => normalizeDialogue(line, market)).filter(Boolean);
    if (market === "overseas") {
      const englishLines = normalized.filter((line) => !hasChinese(line));
      return englishLines.slice(0, 3);
    }
    return normalized.slice(0, 3);
  }
  return [];
}

function normalizeDialogue(line, market) {
  const cleaned = line.replace(/^["“]|["”]$/g, "").trim();
  if (market === "domestic") return cleaned;

  const dictionary = [
    [/你一直都知道/g, "You knew all along"],
    [/出去/g, "Get out"],
    [/签了它/g, "Sign it"],
    [/我爱你/g, "I love you"],
    [/我不需要你的帮助/g, "I don't need your help"],
    [/你以为我不知道/g, "You think I don't know"],
    [/再说一遍/g, "Say that again"],
    [/我拥有这栋楼/g, "I own this building"],
    [/连婚纱都是借的可怜虫/g, "Even her wedding dress was borrowed"],
    [/可怜虫/g, "Poor little thing"],
    [/你是谁/g, "Who are you"],
    [/你知道我是谁/g, "You know who I am"],
    [/再见/g, "Goodbye"]
  ];
  let translated = cleaned;
  dictionary.forEach(([pattern, replacement]) => {
    translated = translated.replace(pattern, replacement);
  });
  return hasChinese(translated) ? "" : translated;
}

function hasChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

function buildProfileDraft() {
  const script = els.scriptInput.value.trim();
  if (!script) {
    showToast("请先输入剧本");
    return;
  }

  const characters = extractCharacters(script);
  const fallback = characters.length ? characters : ["主角A", "对手B"];
  const profile = fallback
    .map((name, index) => {
      const tone = index === 0 ? "控制型/回避型" : "权威型/感性型";
      const tell = index === 0
        ? "紧张时拇指摩擦食指指节；说完重要对白后停顿1秒；被刺痛时先维持礼貌表情"
        : "施压时下巴前伸；说谎时整理领口；被反击时快速眨眼";
      return `人物ID：${name}
人物小传：请根据完整剧本补充3-5句，包含核心伤疤与隐藏需求。
性格底色：${tone}
关系动力学：与其他人物形成“表面对抗 + 隐性需求”的互动，生成前需要人工确认。
专属表演习惯Tell：${tell}
核心情绪微表情库：
- 压抑的愤怒：眉毛压低，下眼睑上提，嘴角横向绷紧，下颌咬肌滑动一次。
- 压抑的悲伤：下眼睑拉紧，嘴唇压成白线，喉结上下滚动一次。
- 强装镇定：呼吸节奏打乱但语速刻意放慢，眼神短暂失焦。`;
    })
    .join("\n\n---\n\n");

  els.profileInput.value = profile;
  state.profileConfirmed = false;
  updateProfileState();
  saveState(false);
  showToast("已生成草案，请确认或修改人设");
}

async function generateProfileWithAi() {
  const script = els.scriptInput.value.trim();
  if (!script) {
    showToast("请先输入或上传剧本");
    return;
  }
  const restore = setBusy(els.aiProfileBtn, true, "生成中");
  try {
    const payload = await requestJson("/api/generate-profile", {
      method: "POST",
      body: JSON.stringify({
        script,
        market: els.marketSelect.value,
        tuning: state.tuning,
        modelConfig: getModelConfigForRequest()
      })
    });
    els.profileInput.value = payload.profile || "";
    state.profileConfirmed = false;
    updateProfileState();
    saveState(false);
    showToast("AI 人设草案已生成，请确认");
  } catch (error) {
    buildProfileDraft();
    showToast(`AI 不可用，已用本地草案兜底：${error.message}`);
  } finally {
    restore();
    refreshAiStatus();
  }
}

function getTuningSummary() {
  const userMessages = state.tuning.filter((message) => message.role === "user").map((message) => message.text);
  if (!userMessages.length) {
    return "调教偏好：默认克制、可观测、少空泛形容词；优先微表情、呼吸和手部动作。";
  }
  return `调教偏好：${userMessages.slice(-4).join("；")}。`;
}

function splitIntoBeats(duration) {
  if (duration === 9) return [[0, 3], [3, 6], [6, 9]];
  if (duration === 15) return [[0, 5], [5, 10], [10, 15]];
  return [[0, 4], [4, 8], [8, 12]];
}

function pickDialogueForBeat(dialogues, index, sceneType) {
  if (!dialogues.length) return "";
  if (sceneType === "breakdown") return "";
  return dialogues[Math.min(index, dialogues.length - 1)];
}

function speechNote(index, sceneType) {
  const notes = {
    reveal: [
      "语气平淡、陈述、不炫耀，音量中等偏低，开口前停顿0.8秒，口型稳定清晰。",
      "语气压低两度，音量稳定，词尾留0.2秒空拍，口型收束克制。",
      "语气中性落点，音量不升不降，说完嘴唇自然闭合，停顿1秒。"
    ],
    argument: [
      "语气像从齿缝里挤出，音量低，开头停顿0.5秒，口型先张开又合上。",
      "语气变快变碎，音量升高，句中断裂两次，口型幅度加大但不夸张。",
      "语气突然疲惫，音量降到很低，尾音破裂，口型在最后一个词后僵住。"
    ],
    confession: [
      "语气近乎耳语，音量很低，关键词前停顿0.4秒，口型轻而完整。",
      "语气自嘲但鼻腔音重，音量偏轻，句尾主动收掉，口型不露齿。",
      "语气放软，音量低，开口前吸气，口型缓慢闭合。"
    ],
    auto: [
      "语气克制，音量中低，开口前停顿0.5秒，口型自然细腻。",
      "语气稳定但呼吸轻乱，音量中等，句中停顿0.3秒，口型清晰。",
      "语气回落，音量降低，尾音短促，口型在说完后保持0.4秒。"
    ]
  };
  return (notes[sceneType] || notes.auto)[index] || notes.auto[index] || notes.auto[0];
}

function sanitizeLine(line) {
  return line
    .replace(/\bfast\b/gi, "迅速但稳定地")
    .replace(/8K|24fps|f\/2\.8|ISO\s*\d+/gi, "")
    .replace(/电影感|高级质感/g, "具体光线与可见动作");
}

function buildLocalPrompt() {
  const selectedText = getSelection();
  if (!selectedText) {
    showToast("请先在左侧选中一段剧情");
    els.scriptInput.focus();
    return;
  }

  if (!state.profileConfirmed) {
    showToast("请先确认人设");
    return;
  }

  const market = els.marketSelect.value;
  const sceneType = detectScene(selectedText);
  const template = sceneTemplates[sceneType] || sceneTemplates.auto;
  const emotion = inferEmotion(selectedText);
  const duration = Number(els.durationSelect.value);
  const beats = splitIntoBeats(duration);
  const dialogues = extractDialogue(selectedText, market);
  const tuning = getTuningSummary();
  const selectedClean = selectedText.replace(/\s+/g, " ").slice(0, 160);

  const prompt = beats.map(([start, end], index) => {
    const dialogue = pickDialogueForBeat(dialogues, index, sceneType);
    const action = template.beats[index] || template.beats[template.beats.length - 1];
    const face = index === 0 ? emotion.face : index === 1 ? emotion.body : `${emotion.face} ${emotion.body}`;
    const imageRef = index === 0 ? "@图1 " : "";
    const dialogueLine = dialogue
      ? `\n对话："${dialogue}" ${speechNote(index, sceneType)}`
      : "";
    return `镜头 ${index + 1} (${start}–${end}秒)：\n${imageRef}${sanitizeLine(action)} ${sanitizeLine(face)} 场景动作围绕所选剧情：“${selectedClean}”展开，动作幅度克制，避免夸张表情。${dialogueLine}`;
  }).join("\n\n");

  const result = `${prompt}

一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。

负向约束：不要字幕、水印和夸张表情；不要生硬切镜；避免抖动和剧烈动作。

设计说明：${template.title}按“心理动作到物理动作”拆成${beats.length}拍；${template.conflict}${tuning}

拆条对应：单条完成。`;

  els.promptOutput.value = result;
  els.promptQuality.textContent = "已生成";
  els.promptQuality.classList.add("is-ok");
  renderChecks(result);
  saveState(false);
  showToast("Prompt 已生成");
}

async function buildPrompt() {
  const selectedText = getSelection();
  if (!selectedText) {
    showToast("请先在左侧选中一段剧情");
    els.scriptInput.focus();
    return;
  }

  if (!state.profileConfirmed) {
    showToast("请先确认人设");
    return;
  }

  const restore = setBusy(els.generateBtn, true, "AI 生成中");
  try {
    const payload = await requestJson("/api/generate-prompt", {
      method: "POST",
      body: JSON.stringify({
        script: els.scriptInput.value,
        selectedText,
        profile: els.profileInput.value,
        market: els.marketSelect.value,
        sceneType: els.sceneTypeSelect.value,
        duration: Number(els.durationSelect.value),
        tuning: state.tuning,
        modelConfig: getModelConfigForRequest()
      })
    });
    els.promptOutput.value = payload.prompt || "";
    els.promptQuality.textContent = "AI 已生成";
    els.promptQuality.classList.add("is-ok");
    renderChecks(els.promptOutput.value);
    saveState(false);
    showToast("AI Prompt 已生成");
  } catch (error) {
    showToast(`AI 不可用，改用本地规则兜底：${error.message}`);
    buildLocalPrompt();
  } finally {
    restore();
    refreshAiStatus();
  }
}

function renderChecks(prompt) {
  const checks = [
    ["包含连续镜头时间戳", /镜头 1 \(0–\d+秒\)：/.test(prompt)],
    ["包含一致性锁定段", prompt.includes("一致性锁定：脸部、发型、服装保持与@图1一致")],
    ["包含负向约束段", prompt.includes("负向约束：不要字幕、水印和夸张表情")],
    ["无明显无效技术参数", !/(8K|24fps|f\/2\.8|ISO\s*\d+|\bfast\b)/i.test(prompt)],
    ["欧美市场对白无中文残留", els.marketSelect.value !== "overseas" || !/对话："[^"]*[\u4e00-\u9fa5]/.test(prompt)],
    ["表演描述含微动作或肌肉信号", /(眉|眼睑|嘴|唇|喉结|指节|呼吸|肩|下颌|鼻翼)/.test(prompt)]
  ];
  els.checkList.innerHTML = "";
  checks.forEach(([label, ok]) => {
    const item = document.createElement("li");
    item.classList.toggle("warn", !ok);
    item.textContent = label;
    els.checkList.append(item);
  });
}

function resetProject() {
  const modelConfig = state.modelConfig;
  const modelCapabilities = state.modelCapabilities;
  const aiConfigured = state.aiConfigured;
  els.projectName.value = "未命名项目";
  els.marketSelect.value = "overseas";
  els.scriptInput.value = "";
  els.profileInput.value = "";
  els.promptOutput.value = "";
  state = {
    aiConfigured,
    modelConfig,
    modelCapabilities,
    profileConfirmed: false,
    tuning: [
      {
        role: "ai",
        text: "默认使用 performance-prompter：可观测微动作、B 格式、英文对白优先、动作幅度克制。你可以在这里继续调教整体偏好。"
      }
    ]
  };
  renderTuningLog();
  renderChecks("");
  updateProfileState();
  updateSelectionCount();
  els.promptQuality.textContent = "未生成";
  els.promptQuality.classList.remove("is-ok");
  saveState(false);
  showToast("已新建空项目");
}

async function copyPrompt() {
  if (!els.promptOutput.value.trim()) {
    showToast("还没有可复制的 Prompt");
    return;
  }
  try {
    await navigator.clipboard.writeText(els.promptOutput.value);
    showToast("已复制");
  } catch (error) {
    els.promptOutput.select();
    document.execCommand("copy");
    showToast("已复制");
  }
}

function downloadPrompt() {
  const content = els.promptOutput.value.trim();
  if (!content) {
    showToast("还没有可下载的 Prompt");
    return;
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = (els.projectName.value.trim() || "prompt").replace(/[^\u4e00-\u9fa5\w-]+/g, "-");
  anchor.href = url;
  anchor.download = `${safeName}-seedance-prompt.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function handleScriptFile(file) {
  if (!file) return;
  const allowed = /\.(pdf|docx?|txt|md)$/i.test(file.name);
  if (!allowed) {
    showToast("只支持 PDF / DOCX / DOC / TXT / MD");
    return;
  }

  const restore = setBusy(els.extractProfileBtn, true, "抽取中");
  els.fileStatus.textContent = `正在抽取：${file.name}`;
  try {
    const data = new FormData();
    data.append("file", file);
    const payload = await requestJson("/api/extract-file", {
      method: "POST",
      body: data
    });
    els.scriptInput.value = payload.text || "";
    state.profileConfirmed = false;
    updateProfileState();
    updateSelectionCount();
    saveState(false);
    const warning = payload.warnings?.length ? `；${payload.warnings.join("；")}` : "";
    els.fileStatus.textContent = `已导入 ${payload.filename}，${payload.chars} 字，方式：${payload.method}${warning}`;
    showToast("剧本文件已导入");
  } catch (error) {
    els.fileStatus.textContent = `抽取失败：${error.message}`;
    showToast(`文件抽取失败：${error.message}`);
  } finally {
    restore();
  }
}

els.newProjectBtn.addEventListener("click", resetProject);
els.saveProjectBtn.addEventListener("click", () => saveState(true));
els.fileDropZone.addEventListener("click", () => els.scriptFileInput.click());
els.fileDropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    els.scriptFileInput.click();
  }
});
els.scriptFileInput.addEventListener("change", () => {
  handleScriptFile(els.scriptFileInput.files?.[0]);
  els.scriptFileInput.value = "";
});
["dragenter", "dragover"].forEach((eventName) => {
  els.fileDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.fileDropZone.classList.add("is-dragover");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  els.fileDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.fileDropZone.classList.remove("is-dragover");
  });
});
els.fileDropZone.addEventListener("drop", (event) => {
  handleScriptFile(event.dataTransfer?.files?.[0]);
});
els.sampleBtn.addEventListener("click", () => {
  els.scriptInput.value = sampleScript;
  els.projectName.value = "Hidden Vows";
  updateSelectionCount();
  saveState(false);
  showToast("已载入示例剧本");
});
els.extractProfileBtn.addEventListener("click", buildProfileDraft);
els.aiProfileBtn.addEventListener("click", generateProfileWithAi);
els.confirmProfileBtn.addEventListener("click", () => {
  if (!els.profileInput.value.trim()) {
    showToast("请先填写或提取人设");
    return;
  }
  state.profileConfirmed = true;
  updateProfileState();
  saveState(false);
  showToast("人设已确认");
});
els.resetProfileBtn.addEventListener("click", () => {
  state.profileConfirmed = false;
  updateProfileState();
  saveState(false);
  showToast("已重置确认状态");
});
els.scriptInput.addEventListener("select", updateSelectionCount);
els.scriptInput.addEventListener("keyup", updateSelectionCount);
els.scriptInput.addEventListener("mouseup", updateSelectionCount);
els.scriptInput.addEventListener("input", () => {
  state.profileConfirmed = false;
  updateProfileState();
  saveState(false);
});
els.profileInput.addEventListener("input", () => {
  state.profileConfirmed = false;
  updateProfileState();
  saveState(false);
});
els.marketSelect.addEventListener("change", () => saveState(false));
els.projectName.addEventListener("input", () => saveState(false));
els.saveModelBtn.addEventListener("click", () => saveModelSettings(true));
els.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = els.authUser.value.trim();
  const password = els.authPassword.value;
  if (!user || !password) {
    els.authError.textContent = "请输入用户名和密码";
    return;
  }
  sessionStorage.setItem(AUTH_STORAGE, btoa(`${user}:${password}`));
  els.authPassword.value = "";
  refreshAiStatus();
});
els.tuningForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.tuningInput.value.trim();
  if (!text) return;
  addMessage("user", text);
  els.tuningInput.value = "";
  requestJson("/api/tune", {
    method: "POST",
    body: JSON.stringify({ message: text, history: state.tuning, modelConfig: getModelConfigForRequest() })
  })
    .then((payload) => addMessage("ai", payload.reply || "已记住这条全局偏好。后续生成会优先影响节奏、表演密度和对白处理。"))
    .catch(() => addMessage("ai", "已记住这条全局偏好。后续生成会把它写入设计说明，并优先影响节奏、表演密度和对白处理。"));
});
els.generateBtn.addEventListener("click", buildPrompt);
els.localGenerateBtn.addEventListener("click", buildLocalPrompt);
els.copyPromptBtn.addEventListener("click", copyPrompt);
els.downloadPromptBtn.addEventListener("click", downloadPrompt);

loadState();
renderTuningLog();
updateProfileState();
updateSelectionCount();
renderChecks(els.promptOutput.value);
refreshAiStatus();
