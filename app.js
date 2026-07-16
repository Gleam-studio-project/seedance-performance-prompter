const STORAGE_KEY = "performance-prompter-workbench";
const MODEL_KEY_STORAGE = `${STORAGE_KEY}:model-key`;
const AUTH_STORAGE = `${STORAGE_KEY}:auth`;
const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:4174" : "";
const LOCAL_PROJECT_CACHE_PREFIX = `${STORAGE_KEY}:project:`;
const LOCAL_LAST_PROJECT_KEY = `${STORAGE_KEY}:last-project-id`;

const els = {
  projectName: document.querySelector("#projectName"),
  marketSelect: document.querySelector("#marketSelect"),
  aiStatus: document.querySelector("#aiStatus"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  backToHomeBtn: document.querySelector("#backToHomeBtn"),
  storageModeHint: document.querySelector("#storageModeHint"),
  homeNewProjectName: document.querySelector("#homeNewProjectName"),
  homeNewProjectMarket: document.querySelector("#homeNewProjectMarket"),
  createProjectBtn: document.querySelector("#createProjectBtn"),
  projectList: document.querySelector("#projectList"),
  projectCountBadge: document.querySelector("#projectCountBadge"),
  projectListState: document.querySelector("#projectListState"),
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
  localGenerateBtn: document.querySelector("#localGenerateBtn"),
  promptQuality: document.querySelector("#promptQuality"),
  toast: document.querySelector("#toast"),
  authOverlay: document.querySelector("#authOverlay"),
  authForm: document.querySelector("#authForm"),
  authUser: document.querySelector("#authUser"),
  authPassword: document.querySelector("#authPassword"),
  authError: document.querySelector("#authError"),
  saveStatus: document.querySelector("#saveStatus"),
  settingsBtn: document.querySelector("#settingsBtn"),
  closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
  settingsDrawer: document.querySelector("#settingsDrawer"),
  stepProgress: document.querySelector("#stepProgress"),
  stepButtons: [...document.querySelectorAll(".step-button")],
  stepPanes: [...document.querySelectorAll(".step-pane")],
  railProjectName: document.querySelector("#railProjectName"),
  railSelectionSummary: document.querySelector("#railSelectionSummary"),
  railRequirementCount: document.querySelector("#railRequirementCount"),
  requirements: [...document.querySelectorAll(".requirement")],
  scriptCharCount: document.querySelector("#scriptCharCount"),
  sceneList: document.querySelector("#sceneList"),
  sceneCandidateCount: document.querySelector("#sceneCandidateCount"),
  selectedSceneCard: document.querySelector("#selectedSceneCard"),
  manualSelectBtn: document.querySelector("#manualSelectBtn"),
  profileCards: document.querySelector("#profileCards"),
  profileActionHint: document.querySelector("#profileActionHint"),
  scriptActionHint: document.querySelector("#scriptActionHint"),
  sceneReadyState: document.querySelector("#sceneReadyState"),
  generationError: document.querySelector("#generationError"),
  promptCheckSummary: document.querySelector("#promptCheckSummary"),
  clearRevisionChatBtn: document.querySelector("#clearRevisionChatBtn"),
  revisionChatLog: document.querySelector("#revisionChatLog"),
  revisionChatForm: document.querySelector("#revisionChatForm"),
  revisionChatInput: document.querySelector("#revisionChatInput"),
  revisionChatSendBtn: document.querySelector("#revisionChatSendBtn"),
  revisePromptBtn: document.querySelector("#revisePromptBtn"),
  quickReviseBtns: [...document.querySelectorAll(".quick-revise-btn")],
  sceneSearchInput: document.querySelector("#sceneSearchInput"),
  sceneEpisodeInput: document.querySelector("#sceneEpisodeInput"),
  sceneListWorkbench: document.querySelector("#sceneListWorkbench"),
  sceneSearchInputWorkbench: document.querySelector("#sceneSearchInputWorkbench"),
  sceneEpisodeInputWorkbench: document.querySelector("#sceneEpisodeInputWorkbench"),
  sceneCandidateCountWorkbench: document.querySelector("#sceneCandidateCountWorkbench"),
  scriptContextView: document.querySelector("#scriptContextView"),
  contextSelectionMeta: document.querySelector("#contextSelectionMeta"),
  sceneTopMeta: document.querySelector("#sceneTopMeta"),
  generateVariantsBtn: document.querySelector("#generateVariantsBtn"),
  variantCount: document.querySelector("#variantCount"),
  variantList: document.querySelector("#variantList"),
  floatingGenerateBtn: document.querySelector("#floatingGenerateBtn"),
  profileModal: document.querySelector("#profileModal"),
  closeProfileModalBtn: document.querySelector("#closeProfileModalBtn"),
  profileModalTitle: document.querySelector("#profileModalTitle"),
  profileModalBody: document.querySelector("#profileModalBody"),
  profileChatLog: document.querySelector("#profileChatLog"),
  profileChatForm: document.querySelector("#profileChatForm"),
  profileChatInput: document.querySelector("#profileChatInput"),
  profileChatSendBtn: document.querySelector("#profileChatSendBtn")
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
  guard: ["病床", "医院", "受伤", "昏睡", "leave me", "守护"],
  humiliation: ["羞辱", "窃笑", "borrowed dress", "可怜虫", "丢脸", "宾客", "mock", "laugh"],
  pressure: ["施压", "压迫", "冷静", "威胁", "低声", "you should know", "最后一次机会"],
  probing: ["试探", "逼问", "到底", "真的吗", "look at me", "answer me", "说实话"],
  coverlie: ["撒谎", "掩饰", "隐瞒", "没事", "I'm fine", "不是那样", "解释"]
};

const sceneTemplates = {
  reveal: { title: "身份揭露", conflict: "本版强调冷静压场与身份反转的张力。", style: "都市反击题材，真实竖屏质感，表演克制但压迫感明确。", sceneName: "身份揭露" },
  argument: { title: "争吵爆发", conflict: "本版强调对抗中的节拍推进与自尊防线。", style: "都市情感冲突，近景现实质感，表演强压不失真实。", sceneName: "争吵爆发" },
  confession: { title: "克制告白", conflict: "本版强调说出口与收回去之间的身体停顿。", style: "克制情感题材，柔和现实影像，表演含蓄细腻。", sceneName: "克制告白" },
  breakdown: { title: "隐忍崩溃", conflict: "本版强调无声崩裂通过局部失控泄漏。", style: "现实情绪戏，贴身观察质感，表演压抑内卷。", sceneName: "隐忍崩溃" },
  reunion: { title: "重逢", conflict: "本版强调熟悉感回潮与礼貌掩饰的并存。", style: "都市重逢题材，生活化影像，表演克制含情。", sceneName: "重逢" },
  farewell: { title: "诀别", conflict: "本版强调关系结束时道具动作中的痛感。", style: "现实关系戏，冷静影像质感，表演收束但刺痛。", sceneName: "诀别" },
  close: { title: "危险靠近", conflict: "本版强调不触碰下的距离压迫。", style: "高张力情感戏，贴身近景质感，表演低调而危险。", sceneName: "危险靠近" },
  guard: { title: "病床守护", conflict: "本版强调静默照料中的未说出口。", style: "守护题材，安静现实影像，表演轻而持续。", sceneName: "病床守护" },
  humiliation: { title: "被羞辱后强撑", conflict: "本版强调体面外壳下的局部失控。", style: "都市反击情绪戏，写实影像质感，表演克制泄漏。", sceneName: "被羞辱后强撑" },
  pressure: { title: "平静施压", conflict: "本版强调低音量、强停顿和注视带来的退路压缩。", style: "高压对手戏，干净现实影像，表演平静但逼人。", sceneName: "平静施压" },
  probing: { title: "试探性逼问", conflict: "本版强调边试探边观察对方破绽。", style: "心理试探戏，近景观察质感，表演轻微推进。", sceneName: "试探性逼问" },
  coverlie: { title: "说谎掩饰", conflict: "本版强调嘴上稳定、身体先露馅。", style: "现实心理戏，贴身观察影像，表演细碎不外露。", sceneName: "说谎掩饰" },
  auto: { title: "情感对手戏", conflict: "本版强调冲突推进主要通过眼神、呼吸和手部动作完成。", style: "现实情感题材，真实竖屏质感，表演克制可观测。", sceneName: "情感对手戏" }
};

const emotionLibrary = {
  restrainedAnger: {
    face: "眉毛压低，下眼睑上提，嘴角横向绷紧，下颌咬肌短暂滑动。",
    body: "身体稳定不前冲，足底压地，手部克制但指节发力。"
  },
  restrainedSadness: {
    face: "下眼睑拉紧，嘴唇压白，喉结滚动一次，眨眼变慢。",
    body: "脊柱勉强挺直，肩颈局部锁死，呼吸短促后被强行压平。"
  },
  attraction: {
    face: "眨眼速度变慢，视线在眼睛与嘴唇之间移动，嘴角极轻上提。",
    body: "身体无意识前倾，重心微移，手部动作变轻。"
  },
  shock: {
    face: "上眼睑上提，嘴唇张开后缓慢合拢，表情冻结片刻。",
    body: "全身短暂停住，手部动作悬空，呼吸骤停后补一口气。"
  },
  contempt: {
    face: "单侧嘴角轻提，下巴略抬，目光带扫描感。",
    body: "身体后靠，鼻腔短促出气，手部动作更慢。"
  },
  controlledCalm: {
    face: "面部中立，下眼睑轻提，眨眼减少，嘴唇收成直线。",
    body: "呼吸被刻意控制，肩膀稳定，手指只出现极小摩擦。"
  }
};

const STEP_ORDER = ["home", "script", "profile", "workbench"];
const DEFAULT_TUNING = [
  {
    role: "ai",
    text: "默认使用 performance-prompter：可观测微动作、Seedance 2.0 分镜结构、对白按市场输出、动作幅度克制。你可以在这里继续调教整体偏好。"
  }
];

let state = createEmptyState();
let projectIndex = [];
let pendingSaveTimer = null;
let serverPersistenceAvailable = true;
let latestSelectionSnapshot = null;

function activeProjectId() {
  return String(state?.projectId || "").trim();
}

function saveState(showMessage = false) {
  persistProjectLocally(showMessage);
  if (!hasOpenedProject()) return;
  queueProjectSave();
}

async function loadState() {
  const currentId = activeProjectId() || localStorage.getItem(LOCAL_LAST_PROJECT_KEY) || "";
  const fallbackDraft = () => {
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (!legacyRaw) {
      applyProjectPayload(buildFreshProjectData());
      setStep("home", { silent: true });
      return;
    }
    try {
      const parsed = JSON.parse(legacyRaw);
      applyProjectPayload(parsed);
      if (parsed?.id) {
        state.projectId = parsed.id;
        localStorage.setItem(LOCAL_LAST_PROJECT_KEY, parsed.id);
      }
      setStep(state.currentStep || (state.projectId ? "script" : "home"), { silent: true });
    } catch {
      applyProjectPayload(buildFreshProjectData());
      setStep("home", { silent: true });
    }
  };

  if (!currentId) {
    fallbackDraft();
    return;
  }

  const localKey = currentProjectStorageKey(currentId);
  const localRaw = localStorage.getItem(localKey);

  try {
    const payload = await requestJson(`/api/projects/${encodeURIComponent(currentId)}`);
    const project = payload?.project || null;
    if (!project) throw new Error("项目不存在");
    serverPersistenceAvailable = payload.writable !== false;
    state.serverSaveDisabled = payload.writable === false;
    applyProjectPayload({
      id: project.id || currentId,
      projectName: project.projectName || "未命名项目",
      market: project.market || "overseas",
      script: project.script || "",
      profile: project.profile || "",
      prompt: project.prompt || "",
      state: normalizeLoadedState({ ...(project.state || {}), projectId: project.id || currentId })
    });
    localStorage.setItem(localKey, JSON.stringify({
      id: project.id || currentId,
      projectName: project.projectName || "未命名项目",
      market: project.market || "overseas",
      script: project.script || "",
      profile: project.profile || "",
      prompt: project.prompt || "",
      state: normalizeLoadedState({ ...(project.state || {}), projectId: project.id || currentId })
    }));
    localStorage.setItem(LOCAL_LAST_PROJECT_KEY, project.id || currentId);
    setStep(state.currentStep || "script", { silent: true });
    return;
  } catch {
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        applyProjectPayload({
          id: parsed.id || currentId,
          projectName: parsed.projectName || "未命名项目",
          market: parsed.market || "overseas",
          script: parsed.script || "",
          profile: parsed.profile || "",
          prompt: parsed.prompt || "",
          state: normalizeLoadedState({ ...(parsed.state || {}), projectId: parsed.id || currentId })
        });
        state.serverSaveDisabled = true;
        if (els.storageModeHint) els.storageModeHint.hidden = false;
        setStep(state.currentStep || "script", { silent: true });
        return;
      } catch {
        // continue to legacy fallback
      }
    }
    fallbackDraft();
  }
}

async function fetchProjectList(showError = true) {
  try {
    const payload = await requestJson("/api/projects");
    projectIndex = Array.isArray(payload?.projects) ? payload.projects : [];
    serverPersistenceAvailable = payload?.writable !== false;
    if (state.serverSaveDisabled && serverPersistenceAvailable) state.serverSaveDisabled = false;
    renderProjectList();
    return projectIndex;
  } catch (error) {
    projectIndex = [];
    serverPersistenceAvailable = false;
    renderProjectList();
    if (showError) showToast(`项目列表获取失败：${error.message}`);
    return [];
  }
}

function renderProjectList() {
  if (els.projectCountBadge) els.projectCountBadge.textContent = String(projectIndex.length);

  if (!els.projectList) return;

  if (!projectIndex.length) {
    els.projectList.innerHTML = "";
    if (els.projectListState) {
      els.projectListState.textContent = serverPersistenceAvailable
        ? "还没有项目，先新建一个。"
        : "当前无法读取服务端项目列表，可继续使用本机存储模式。";
    }
    return;
  }

  if (els.projectListState) {
    els.projectListState.textContent = serverPersistenceAvailable
      ? `共 ${projectIndex.length} 个项目`
      : `已显示 ${projectIndex.length} 个项目`;
  }

  els.projectList.innerHTML = "";
  projectIndex.forEach((project) => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.dataset.projectId = project.id;
    const updatedAt = project.updatedAt ? new Date(project.updatedAt).toLocaleString("zh-CN") : "未记录更新时间";
    card.innerHTML = `
      <div class="project-card-head">
        <strong>${escapeHtml(project.projectName || "未命名项目")}</strong>
        <span class="meta-line">${escapeHtml(project.market === "domestic" ? "国内" : "海外")}</span>
      </div>
      <div class="project-card-meta">
        <span class="meta-line">${escapeHtml(project.id || "")}</span>
        <span class="meta-line">${escapeHtml(updatedAt)}</span>
      </div>
      <div class="project-card-actions">
        <button type="button" class="primary-button" data-action="open">打开项目</button>
        <button type="button" class="ghost-button" data-action="delete">删除</button>
      </div>
    `;
    card.querySelector('[data-action="open"]').addEventListener("click", () => openProjectByMeta(project));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProjectByMeta(project));
    els.projectList.append(card);
  });
}

async function deleteProjectByMeta(project) {
  if (!project?.id) return;
  if (!window.confirm(`确认删除项目「${project.projectName || project.id}」？此操作不可恢复。`)) return;
  try {
    await requestJson(`/api/projects/${project.id}`, { method: "DELETE" });
  } catch (error) {
    showToast(`删除失败：${error.message}`);
    return;
  }
  localStorage.removeItem(LOCAL_PROJECT_CACHE_PREFIX + project.id);
  if (activeProjectId() === project.id) {
    state.projectId = "";
    localStorage.removeItem(LOCAL_LAST_PROJECT_KEY);
  }
  showToast("已删除项目");
  await refreshProjects();
}

async function refreshProjects() {
  await fetchProjectList(false);
  renderProjectList();
}

async function createProjectOnServer() {
  const projectName = els.homeNewProjectName?.value.trim() || els.projectName?.value.trim() || "未命名项目";
  const market = els.homeNewProjectMarket?.value || els.marketSelect?.value || "overseas";

  try {
    const payload = await requestJson("/api/projects", {
      method: "POST",
      body: JSON.stringify({ projectName, market })
    });
    const project = payload?.project || null;
    serverPersistenceAvailable = payload?.writable !== false;
    if (project) {
      await fetchProjectList(false);
      return project;
    }
  } catch {
    serverPersistenceAvailable = false;
  }

  const fallbackId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.replace(/[^a-z0-9-]/g, "-");
  const localProject = {
    id: fallbackId,
    projectName,
    market,
    updatedAt: new Date().toISOString(),
    writable: false
  };
  state.serverSaveDisabled = true;
  if (els.storageModeHint) els.storageModeHint.hidden = false;
  const fresh = buildFreshProjectData({ projectId: fallbackId, projectName, market });
  applyProjectPayload({ id: fallbackId, ...fresh });
  localStorage.setItem(currentProjectStorageKey(fallbackId), JSON.stringify({ id: fallbackId, ...fresh }));
  localStorage.setItem(LOCAL_LAST_PROJECT_KEY, fallbackId);
  if (!projectIndex.find((item) => item.id === fallbackId)) {
    projectIndex = [localProject, ...projectIndex];
  }
  renderProjectList();
  return localProject;
}

async function openProjectByMeta(project) {
  if (!project?.id) return;
  try {
    const payload = await requestJson(`/api/projects/${encodeURIComponent(project.id)}`);
    const loaded = payload?.project || project;
    serverPersistenceAvailable = payload?.writable !== false;
    state.serverSaveDisabled = payload?.writable === false;
    applyProjectPayload({
      id: loaded.id || project.id,
      projectName: loaded.projectName || project.projectName || "未命名项目",
      market: loaded.market || project.market || "overseas",
      script: loaded.script || "",
      profile: loaded.profile || "",
      prompt: loaded.prompt || "",
      state: normalizeLoadedState({ ...(loaded.state || {}), projectId: loaded.id || project.id })
    });
    localStorage.setItem(currentProjectStorageKey(loaded.id || project.id), JSON.stringify({
      id: loaded.id || project.id,
      projectName: loaded.projectName || project.projectName || "未命名项目",
      market: loaded.market || project.market || "overseas",
      script: loaded.script || "",
      profile: loaded.profile || "",
      prompt: loaded.prompt || "",
      state: normalizeLoadedState({ ...(loaded.state || {}), projectId: loaded.id || project.id })
    }));
    localStorage.setItem(LOCAL_LAST_PROJECT_KEY, loaded.id || project.id);
  } catch {
    const cached = localStorage.getItem(currentProjectStorageKey(project.id));
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        applyProjectPayload(parsed);
        state.serverSaveDisabled = true;
        serverPersistenceAvailable = false;
        if (els.storageModeHint) els.storageModeHint.hidden = false;
      } catch {
        applyProjectPayload(buildFreshProjectData({
          projectId: project.id,
          projectName: project.projectName || "未命名项目",
          market: project.market || "overseas"
        }));
      }
    } else {
      applyProjectPayload(buildFreshProjectData({
        projectId: project.id,
        projectName: project.projectName || "未命名项目",
        market: project.market || "overseas"
      }));
    }
  }

  if (els.homeNewProjectName) els.homeNewProjectName.value = els.projectName.value || "";
  if (els.homeNewProjectMarket) els.homeNewProjectMarket.value = els.marketSelect.value || "overseas";
  setStep(state.currentStep && state.currentStep !== "home" ? state.currentStep : "script", { silent: true });
  updateWorkflowStatus();
}

function createEmptyState() {
  return {
    projectId: "",
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
    currentStep: "home",
    sceneSelection: "",
    sceneSelectionRange: null,
    currentVariants: [],
    activeVariantId: "",
    lastGeneratedPrompt: "",
    adoptedVariantId: "",
    contextSelectionRange: null,
    profileChatHistories: {},
    profileCardOpenMap: {},
    profileModalCharacterId: "",
    tuning: [...DEFAULT_TUNING],
    revisionChatHistory: [],
    floatingSelection: null,
    serverSaveDisabled: false,
    updatedAt: ""
  };
}

function currentProjectStorageKey(projectId = state.projectId) {
  return `${LOCAL_PROJECT_CACHE_PREFIX}${projectId || "draft"}`;
}

function normalizeLoadedState(candidate = {}) {
  const next = { ...createEmptyState(), ...(candidate || {}) };
  next.currentVariants = Array.isArray(next.currentVariants) ? next.currentVariants : [];
  next.activeVariantId = next.activeVariantId || "";
  next.adoptedVariantId = next.adoptedVariantId || "";
  next.profileChatHistories = next.profileChatHistories && typeof next.profileChatHistories === "object" ? next.profileChatHistories : {};
  next.profileCardOpenMap = next.profileCardOpenMap && typeof next.profileCardOpenMap === "object" ? next.profileCardOpenMap : {};
  next.profileModalCharacterId = next.profileModalCharacterId || "";
  next.contextSelectionRange = next.contextSelectionRange && typeof next.contextSelectionRange === "object" ? next.contextSelectionRange : null;
  next.sceneSelectionRange = next.sceneSelectionRange && typeof next.sceneSelectionRange === "object" ? next.sceneSelectionRange : null;
  next.tuning = Array.isArray(next.tuning) && next.tuning.length ? next.tuning : [...DEFAULT_TUNING];
  next.revisionChatHistory = Array.isArray(next.revisionChatHistory) ? next.revisionChatHistory : [];
  next.floatingSelection = next.floatingSelection && typeof next.floatingSelection === "object" ? next.floatingSelection : null;
  next.serverSaveDisabled = Boolean(next.serverSaveDisabled);
  return next;
}

function currentStepIndex() {
  return Math.max(0, STEP_ORDER.indexOf(state.currentStep));
}

function hasSelectedScene() {
  return Boolean(getSceneSelectionText());
}

function isStepComplete(step) {
  if (step === "home") return true;
  if (step === "script") return Boolean(els.scriptInput.value.trim());
  if (step === "profile") return Boolean(state.profileConfirmed && els.profileInput.value.trim());
  if (step === "workbench") {
    const adopted = (state.currentVariants || []).find((item) => item.id === state.adoptedVariantId);
    return Boolean(adopted && String(adopted.prompt || "").trim());
  }
  return false;
}

function hasOpenedProject() {
  return Boolean(state.projectId);
}

function canEnterStep(step) {
  const index = STEP_ORDER.indexOf(step);
  if (step === "home") return true;
  if (!hasOpenedProject()) {
    showToast("请先从首页新建或打开项目");
    return false;
  }
  if (index <= 1) return true;
  if (!els.scriptInput.value.trim()) {
    showToast("先导入或粘贴完整剧本");
    return false;
  }
  if (index >= 3 && !isStepComplete("profile")) {
    showToast("先确认人物表演档案");
    return false;
  }
  return true;
}

function setStep(step, { silent = false } = {}) {
  if (!STEP_ORDER.includes(step) || (!silent && !canEnterStep(step))) return;
  state.currentStep = step;

  els.stepPanes.forEach((pane) => {
    const active = pane.dataset.stepPane === step;
    pane.classList.toggle("is-active", active);
    pane.hidden = !active;
  });

  els.stepButtons.forEach((button) => {
    const active = button.dataset.step === step;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "step" : "false");
  });

  if (step === "home") {
    els.stepProgress.textContent = "首页";
  } else {
    els.stepProgress.textContent = `第 ${Math.max(1, currentStepIndex())} 步，共 3 步`;
  }

  updateWorkflowStatus();
  updateSceneSummary();
  renderScriptContextView();
  renderRevisionChatLog();
  if (step === "workbench") {
    renderSceneCandidates();
    renderVariantList();
  }
  persistProjectLocally(false);
}

function updateWorkflowStatus() {
  const completeCount = ["script", "profile", "workbench"].filter(isStepComplete).length;
  els.railRequirementCount.textContent = `${completeCount}/3`;
  els.stepButtons.forEach((button) => {
    if (button.dataset.step === "home") {
      button.classList.remove("is-complete");
      return;
    }
    button.classList.toggle("is-complete", isStepComplete(button.dataset.step));
  });
  els.requirements.forEach((button) => button.classList.toggle("is-done", isStepComplete(button.dataset.requirement)));
  els.railProjectName.textContent = els.projectName.value.trim() || "未命名项目";
  els.railSelectionSummary.textContent = hasOpenedProject()
    ? hasSelectedScene() ? `${getSceneSelectionText().length} 字场次已选` : "尚未选择场次"
    : "尚未打开项目";
  if (els.scriptActionHint) els.scriptActionHint.textContent = els.scriptInput.value.trim() ? "剧本已导入，可继续确认人设" : "先导入完整剧本，再进入人设";
  if (els.profileActionHint) els.profileActionHint.textContent = state.profileConfirmed ? "人设已确认，下一步进入工作台生产" : "确认人设后进入工作台";
  if (els.backToHomeBtn) els.backToHomeBtn.hidden = !hasOpenedProject();
  if (els.storageModeHint) els.storageModeHint.hidden = !(state.serverSaveDisabled || !serverPersistenceAvailable);
}

function updateSaveStatus(status = "已保存") {
  if (els.saveStatus) els.saveStatus.textContent = status;
}

function splitSceneCandidates(script) {
  const normalized = String(script || "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const candidates = [];
  const sceneHeaderPattern = /^\s*(?:第\s*[0-9一二三四五六七八九十百千万]+\s*(?:集|场)|第[0-9一二三四五六七八九十百千万]+集|第[0-9一二三四五六七八九十百千万]+场|场景\s*[0-9一二三四五六七八九十百千万A-Za-z]*|内景|外景|INT\.|EXT\.|SCENE\s*\d+|序幕|尾声|闪回|转场|第\s*[0-9A-Za-z一二三四五六七八九十百千万]+\s*幕|幕\s*[0-9A-Za-z一二三四五六七八九十百千万]+)\s*[:：.．、\-—]?.*$/i;
  const episodeOnlyPattern = /^\s*第\s*([0-9一二三四五六七八九十百千万]+)\s*集\s*$/;
  const noiseHeaderPattern = /^\s*(?:项目|目标市场|主要人物|人物|角色|人物介绍|梗概|简介|大纲|对白|人物小传|性格底色|关系动力学)\s*[:：]/;

  const headerIndexes = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (sceneHeaderPattern.test(line) || episodeOnlyPattern.test(line)) headerIndexes.push(i);
  }

  if (headerIndexes.length) {
    const boundaries = [...headerIndexes, lines.length];
    for (let i = 0; i < headerIndexes.length; i += 1) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const block = lines.slice(start, end).join("\n").trim();
      if (block.length >= 20 && !noiseHeaderPattern.test((block.split("\n")[0] || "").trim())) {
        candidates.push(block);
      }
    }
  }

  if (candidates.length < 2) {
    const paragraphBlocks = normalized
      .split(/\n\s*\n+/)
      .map((block) => block.trim())
      .filter(Boolean);

    let current = [];
    for (let i = 0; i < paragraphBlocks.length; i += 1) {
      const block = paragraphBlocks[i];
      const firstLine = (block.split("\n")[0] || "").trim();
      const looksLikeHeader = sceneHeaderPattern.test(firstLine) || episodeOnlyPattern.test(firstLine);
      if (looksLikeHeader && current.length) {
        const merged = current.join("\n\n").trim();
        if (merged.length >= 20) candidates.push(merged);
        current = [block];
      } else if (!current.length) {
        current = [block];
      } else {
        current.push(block);
      }
    }
    if (current.length) {
      const merged = current.join("\n\n").trim();
      if (merged.length >= 20) candidates.push(merged);
    }
  }

  const unique = [];
  const seen = new Set();
  for (let i = 0; i < candidates.length; i += 1) {
    const text = candidates[i].trim();
    if (!text) continue;
    const key = text.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
  }

  if (!unique.length && normalized.length >= 40) {
    const fallback = normalized
      .split(/\n\s*\n+/)
      .map((block) => block.trim())
      .filter((block) => block.length >= 40);
    return fallback.map((text, index) => ({
      id: `scene-${index + 1}`,
      text,
      title: sceneTitle(text, index),
      episode: extractEpisodeNumber(text)
    }));
  }

  return unique.map((text, index) => ({
    id: `scene-${index + 1}`,
    text,
    title: sceneTitle(text, index),
    episode: extractEpisodeNumber(text)
  }));
}

function extractEpisodeNumber(text) {
  const match = String(text || "").match(/第\s*([0-9]+)\s*集/);
  return match ? Number(match[1]) : null;
}

function sceneTitle(text, index) {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const headerLine = lines.find((line) => /^(?:第\s*[0-9一二三四五六七八九十百千万]+\s*(?:集|场)|场景|内景|外景|INT\.|EXT\.|SCENE|序幕|尾声|闪回|第.*幕|幕)/i.test(line));
  const firstLine = headerLine || lines[0] || "";
  const cleaned = firstLine.replace(/^[#\s-]+/, "").trim();
  return cleaned.slice(0, 48) || `候选场次 ${index + 1}`;
}

function getSceneFilters() {
  const searchA = document.querySelector("#sceneSearchInput")?.value.trim().toLowerCase() || "";
  const epA = document.querySelector("#sceneEpisodeInput")?.value.trim() || "";
  const searchB = document.querySelector("#sceneSearchInputWorkbench")?.value.trim().toLowerCase() || "";
  const epB = document.querySelector("#sceneEpisodeInputWorkbench")?.value.trim() || "";
  return {
    search: searchB || searchA,
    episode: epB || epA
  };
}

function matchEpisodeFilter(episode, rawFilter) {
  const value = String(rawFilter || "").trim();
  if (!value) return true;
  if (!episode) return false;
  if (/^\d+$/.test(value)) return episode === Number(value);
  const range = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return episode >= start && episode <= end;
  }
  return true;
}

function renderSceneCandidates() {
  const candidates = splitSceneCandidates(els.scriptInput.value);
  const filters = getSceneFilters();
  const filtered = candidates.filter((candidate) => {
    const text = `${candidate.title}\n${candidate.text}`.toLowerCase();
    const searchOk = !filters.search || text.includes(filters.search);
    const episodeOk = matchEpisodeFilter(candidate.episode, filters.episode);
    return searchOk && episodeOk;
  });

  if (els.sceneCandidateCount) els.sceneCandidateCount.textContent = String(filtered.length);
  if (els.sceneCandidateCountWorkbench) els.sceneCandidateCountWorkbench.textContent = String(filtered.length);

  const lists = [els.sceneList, els.sceneListWorkbench].filter(Boolean);
  lists.forEach((list) => {
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state">没有匹配的候选场次，请调整搜索词或集数筛选。</div>';
      return;
    }
    list.innerHTML = "";
    filtered.forEach((candidate) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "scene-card";
      card.dataset.sceneId = candidate.id;
      if (state.sceneSelection === candidate.text) card.classList.add("is-selected");
      const preview = candidate.text.replace(/\s+/g, " ").slice(0, 180);
      const selectedMeta = state.sceneSelection === candidate.text ? " · 已选中" : "";
      card.innerHTML = `
        <strong>${escapeHtml(candidate.title)}</strong>
        <span>${escapeHtml(preview)}${candidate.text.length > 180 ? "…" : ""}</span>
        <em>${candidate.episode ? `第 ${candidate.episode} 集` : "未识别集数"} · ${candidate.text.length} 字${selectedMeta}</em>
      `;
      card.addEventListener("click", () => selectSceneCandidate(candidate));
      list.append(card);
    });
  });

  const selected = getSceneSelectionText();
  if (selected) renderSelectedScene(selected);
}

function selectSceneCandidate(candidate) {
  const script = els.scriptInput.value;
  const start = script.indexOf(candidate.text);
  if (start >= 0) {
    const end = start + candidate.text.length;
    els.scriptInput.focus();
    els.scriptInput.setSelectionRange(start, end);
    state.sceneSelectionRange = { start, end, baseStart: start, baseEnd: end };
    state.contextSelectionRange = { start, end };
  }
  state.sceneSelection = candidate.text;
  renderSelectedScene(candidate.text, candidate.title);
  updateSelectionCount({ rerenderContext: true });
  renderSceneCandidates();
  renderScriptContextView();
  updateWorkflowStatus();
  queueProjectSave();
  showToast("场次已选中");
}

function renderSelectedScene(text, title = "当前场次") {
  if (!text) {
    els.selectedSceneCard.hidden = true;
    return;
  }
  const compact = text.replace(/\s+/g, " ").trim();
  els.selectedSceneCard.hidden = false;
  els.selectedSceneCard.innerHTML = text.length > 130
    ? `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(compact.slice(0, 220))}…</p><details><summary>展开查看全文</summary><p>${escapeHtml(text)}</p></details>`
    : `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(compact)}</p>`;
}

function updateSceneSummary() {
  const selected = getSceneSelectionText();
  if (!selected) {
    if (els.sceneReadyState) {
      els.sceneReadyState.textContent = "待设置";
      els.sceneReadyState.classList.remove("is-ok");
    }
    if (els.contextSelectionMeta) els.contextSelectionMeta.textContent = "未选择";
    if (els.sceneTopMeta) els.sceneTopMeta.textContent = "尚未选择场次";
    return;
  }
  if (els.sceneReadyState) {
    els.sceneReadyState.textContent = "可以生成";
    els.sceneReadyState.classList.add("is-ok");
  }
  if (els.contextSelectionMeta) els.contextSelectionMeta.textContent = `${selected.length} 字已选`;
  if (els.sceneTopMeta) {
    els.sceneTopMeta.textContent = `${sceneTitle(selected, 0)} · ${selected.length} 字`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

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
    if (els.generateVariantsBtn) els.generateVariantsBtn.disabled = false;
    els.aiProfileBtn.disabled = false;
  } catch {
    state.aiConfigured = false;
    els.aiStatus.textContent = location.protocol === "file:" ? "需启动服务" : "待连接";
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

  els.modelInput.placeholder = modelConfig.model || status.model || "deepseek-chat";
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
  persistProjectLocally(false);
}

function saveModelSettings(showMessage = true) {
  syncModelConfigFromInputs(true);
  if (showMessage) showToast("模型设置已保存");
  refreshAiStatus();
}

function serializeProjectPayload() {
  const adopted = (state.currentVariants || []).find((item) => item.id === state.adoptedVariantId);
  return {
    id: state.projectId || "",
    projectName: els.projectName.value.trim() || "未命名项目",
    market: els.marketSelect.value,
    script: els.scriptInput.value,
    profile: els.profileInput.value,
    prompt: adopted?.prompt || "",
    state: {
      ...state,
      updatedAt: new Date().toISOString()
    }
  };
}

function persistProjectLocally(showMessage = false) {
  const payload = serializeProjectPayload();
  if (payload.id) {
    localStorage.setItem(currentProjectStorageKey(payload.id), JSON.stringify(payload));
    localStorage.setItem(LOCAL_LAST_PROJECT_KEY, payload.id);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
  updateSaveStatus("已保存");
  if (showMessage) showToast("已保存到本机浏览器");
}

function queueProjectSave() {
  persistProjectLocally(false);
  if (!hasOpenedProject()) return;
  updateSaveStatus("保存中…");
  window.clearTimeout(pendingSaveTimer);
  pendingSaveTimer = window.setTimeout(() => {
    saveProjectToServer().catch(() => {});
  }, 3000);
}

async function saveProjectToServer({ immediate = false, showToastMessage = false } = {}) {
  persistProjectLocally(false);
  if (!hasOpenedProject()) return;
  if (state.serverSaveDisabled || !serverPersistenceAvailable) {
    updateSaveStatus("已保存");
    return;
  }
  if (immediate) window.clearTimeout(pendingSaveTimer);

  try {
    await requestJson(`/api/projects/${state.projectId}`, {
      method: "PUT",
      body: JSON.stringify(serializeProjectPayload())
    });
    updateSaveStatus("已保存");
    if (showToastMessage) showToast("项目已保存");
    await fetchProjectList(false);
  } catch (error) {
    if (/Read-only|EROFS|ENOTSUP|EACCES|不可写|write/i.test(error.message || "")) {
      state.serverSaveDisabled = true;
      serverPersistenceAvailable = false;
      if (els.storageModeHint) els.storageModeHint.hidden = false;
      updateSaveStatus("已保存");
      if (showToastMessage) showToast("当前为本机存储模式");
      persistProjectLocally(false);
      return;
    }
    updateSaveStatus("保存失败");
    if (showToastMessage) showToast(`保存失败：${error.message}`);
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function createVariantId() {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSceneDirectingOptions() {
  return {
    lead: "auto",
    mustTell: "",
    intensity: "auto"
  };
}

function detectProfileNames() {
  const raw = els.profileInput.value || "";
  return [...raw.matchAll(/人物ID\s*[:：]\s*([^\n]+)/g)].map((match) => match[1].trim()).filter(Boolean).slice(0, 16);
}

function renderVariantList() {
  const variants = Array.isArray(state.currentVariants) ? state.currentVariants : [];
  els.variantCount.textContent = String(variants.length);
  if (!variants.length) {
    els.variantList.innerHTML = '<div class="empty-state">还没有版本。先在左侧选择场次或文本，再生成 3 版 Prompt。</div>';
    return;
  }

  els.variantList.innerHTML = "";
  variants.forEach((variant, index) => {
    const card = document.createElement("article");
    card.className = "variant-editor-card";
    if (variant.id === state.adoptedVariantId) card.classList.add("is-active");
    const adopted = variant.id === state.adoptedVariantId;
    const preferenceRecorded = Boolean(variant.preferenceRecorded);

    card.innerHTML = `
      <div class="variant-editor-head">
        <strong>${escapeHtml(variant.label || `版本 ${index + 1}`)}</strong>
        <span class="state-pill ${variant.source === "ai" ? "is-ok" : "is-warn"}">${variant.source === "ai" ? "AI" : "本地"}</span>
      </div>
      <div class="variant-editor-meta">
        <span class="variant-editor-note">${escapeHtml(variant.strategy || "")}</span>
        <span class="variant-editor-note">${adopted ? "当前采用中" : "未采用"}</span>
      </div>
      <textarea class="variant-editor-textarea" data-variant-id="${escapeHtml(variant.id)}" spellcheck="false">${escapeHtml(variant.prompt || "")}</textarea>
      <div class="variant-editor-footer">
        <div>
          ${adopted ? '<span class="variant-adopted-badge">已采用</span>' : '<span class="variant-muted-hint">编辑该版本即视为采用</span>'}
        </div>
        <div>
          ${preferenceRecorded ? '<span class="variant-pref-hint">偏好已记录</span>' : '<span class="variant-muted-hint">手改后将自动静默沉淀偏好</span>'}
        </div>
      </div>
    `;

    els.variantList.append(card);
  });

  [...els.variantList.querySelectorAll("textarea[data-variant-id]")].forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const variantId = textarea.dataset.variantId;
      const variant = (state.currentVariants || []).find((item) => item.id === variantId);
      if (!variant) return;
      variant.prompt = textarea.value;
      state.activeVariantId = variantId;
      state.adoptedVariantId = variantId;
      els.promptQuality.textContent = variant.source === "ai" ? "已采用 AI 版本" : "已采用本地版本";
      els.promptQuality.classList.toggle("is-ok", variant.source === "ai");
      updatePromptCheckSummary();
      queuePreferenceInference(variant);
      queueProjectSave();
      renderVariantList();
    });
  });
}

function applyVariant(variantId) {
  const variant = (state.currentVariants || []).find((item) => item.id === variantId);
  if (!variant) return;
  state.activeVariantId = variant.id;
  state.adoptedVariantId = variant.id;
  els.promptQuality.textContent = variant.source === "ai" ? "已采用 AI 版本" : "已采用本地版本";
  els.promptQuality.classList.toggle("is-ok", variant.source === "ai");
  updatePromptCheckSummary();
  renderVariantList();
  setStep("workbench", { silent: true });
  queueProjectSave();
}

function registerVariant(prompt, source, label, strategy = "") {
  const variant = {
    id: createVariantId(),
    prompt,
    source,
    label,
    strategy,
    originalPrompt: prompt,
    preferenceRecorded: false
  };
  state.currentVariants = [...(state.currentVariants || []), variant].slice(-12);
  state.activeVariantId = variant.id;
  if (!state.adoptedVariantId) state.adoptedVariantId = variant.id;
  renderVariantList();
  updatePromptCheckSummary();
  return variant;
}

function transformLocalVariant(basePrompt, strategy) {
  let prompt = String(basePrompt || "");
  if (strategy === "restrained") {
    prompt = prompt.replace(/约束：/g, "约束：整体再收一档，减少外放情绪词，");
  }
  if (strategy === "subtext") {
    prompt = prompt.replace(/约束：/g, "约束：强化潜台词与身体泄漏，减少解释性对白，");
  }
  if (strategy === "physical") {
    prompt = prompt.replace(/约束：/g, "约束：增加手部、呼吸、喉结与目光路径，");
  }
  return prompt;
}

function updateProfileState() {
  els.profileState.textContent = state.profileConfirmed ? "已确认" : "待确认";
  els.profileState.classList.toggle("is-ok", state.profileConfirmed);
  els.profileState.classList.toggle("is-warn", !state.profileConfirmed);
  renderProfileCards();
  updateWorkflowStatus();
}

function parseProfileBlocks(raw) {
  const text = String(raw || "").replace(/\r/g, "").trim();
  if (!text) return [];

  const normalized = text.replace(/\n\s*---\s*\n/g, "\n");
  const matches = [...normalized.matchAll(/(^|\n)\s*人物ID\s*[:：]\s*/g)];
  if (!matches.length) return [{ raw: text }];

  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index + (matches[i][1] ? matches[i][1].length : 0);
    const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    const block = normalized.slice(start, end).trim();
    if (block) blocks.push({ raw: block });
  }
  return blocks;
}

function parseProfileFields(blockText) {
  const fieldNames = ["人物ID", "人物小传", "性格底色", "关系动力学", "贯穿情感弧线", "专属表演习惯Tell", "核心情绪微表情库"];
  const aliases = { "表演习惯Tell": "专属表演习惯Tell", "Tell": "专属表演习惯Tell", "微表情库": "核心情绪微表情库" };
  const lines = String(blockText || "").split("\n");
  const result = {};
  let currentField = "";

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      if (currentField) result[currentField] += `${result[currentField] ? "\n" : ""}`;
      continue;
    }

    const fieldMatch = line.match(/^(人物ID|人物小传|性格底色|关系动力学|贯穿情感弧线|专属表演习惯Tell|表演习惯Tell|Tell|核心情绪微表情库|微表情库)\s*[:：]\s*(.*)$/);
    if (fieldMatch) {
      currentField = aliases[fieldMatch[1]] || fieldMatch[1];
      result[currentField] = (fieldMatch[2] || "").trim();
    } else if (currentField) {
      result[currentField] = `${result[currentField] ? `${result[currentField]}\n` : ""}${rawLine.trimEnd()}`;
    }
  }

  fieldNames.forEach((name) => { if (!result[name]) result[name] = ""; });
  return result;
}

function renderProfileCards() {
  const raw = els.profileInput?.value.trim() || "";
  if (!raw) {
    els.profileCards.innerHTML = '<div class="empty-state">还没有人设草案。点击“AI 生成人设草案”，或从左侧剧本提取。</div>';
    return;
  }

  const blocks = parseProfileBlocks(raw);
  const parsedCards = blocks.map((block) => parseProfileFields(block.raw));
  els.profileCards.innerHTML = "";

  parsedCards.forEach((cardData, index) => {
    const characterId = cardData["人物ID"] || `人物 ${index + 1}`;
    const card = document.createElement("article");
    card.className = "profile-card";
    card.dataset.characterId = characterId;

    const moreOpen = Boolean(state.profileCardOpenMap?.[characterId]);

    card.innerHTML = `
      <div class="profile-card-head">
        <strong>${escapeHtml(characterId)}</strong>
        <span class="state-pill ${state.profileConfirmed ? "is-ok" : "is-warn"}">${state.profileConfirmed ? "已确认" : "待确认"}</span>
      </div>

      <div class="profile-field">
        <span>人物小传</span>
        <div class="profile-field-value">${escapeHtml(cardData["人物小传"] || "未填写")}</div>
      </div>

      <div class="profile-field">
        <span>性格底色</span>
        <div class="profile-field-value">${escapeHtml(cardData["性格底色"] || "未填写")}</div>
      </div>

      <details class="profile-card-more" ${moreOpen ? "open" : ""}>
        <summary>${moreOpen ? "收起补充字段" : "展开补充字段"}</summary>
        <div class="profile-field">
          <span>关系动力学</span>
          <div class="profile-field-value">${escapeHtml(cardData["关系动力学"] || "未填写")}</div>
        </div>
        <div class="profile-field">
          <span>贯穿情感弧线</span>
          <div class="profile-field-value">${escapeHtml(cardData["贯穿情感弧线"] || "未填写")}</div>
        </div>
        <div class="profile-field">
          <span>专属表演习惯Tell</span>
          <div class="profile-field-value">${escapeHtml(cardData["专属表演习惯Tell"] || "未填写")}</div>
        </div>
      </details>

      <div class="profile-card-actions">
        <button class="ghost-button profile-card-open" type="button" data-open-profile="${escapeHtml(characterId)}">查看详情 / 对话修改</button>
      </div>
    `;

    card.querySelector("details")?.addEventListener("toggle", (event) => {
      state.profileCardOpenMap[characterId] = event.currentTarget.open;
      queueProjectSave();
    });

    card.addEventListener("click", (event) => {
      if (event.target.closest("summary") || event.target.closest("button")) return;
      openProfileModal(characterId);
    });

    card.querySelector("[data-open-profile]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openProfileModal(characterId);
    });

    els.profileCards.append(card);
  });
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

function getSceneSelectionText() {
  if (state.contextSelectionRange && typeof state.contextSelectionRange.start === "number" && typeof state.contextSelectionRange.end === "number") {
    const selected = els.scriptInput.value.slice(state.contextSelectionRange.start, state.contextSelectionRange.end).trim();
    if (selected) {
      state.sceneSelection = selected;
      state.sceneSelectionRange = { start: state.contextSelectionRange.start, end: state.contextSelectionRange.end };
      return selected;
    }
  }

  const start = els.scriptInput.selectionStart;
  const end = els.scriptInput.selectionEnd;
  const selected = els.scriptInput.value.slice(start, end).trim();
  if (selected) {
    state.sceneSelection = selected;
    state.sceneSelectionRange = { start, end, currentStart: start, currentEnd: end };
    return selected;
  }
  return state.sceneSelection || "";
}

function updateSelectionCount({ rerenderContext = true } = {}) {
  const selected = getSceneSelectionText();
  els.selectionCount.textContent = selected ? `${selected.length} 字场次已选` : "未选择场次";
  els.scriptCharCount.textContent = `${els.scriptInput.value.length.toLocaleString("zh-CN")} 字`;
  if (selected) renderSelectedScene(selected);
  updateSceneSummary();
  if (rerenderContext) renderScriptContextView();
  updateWorkflowStatus();
}

function addMessage(role, text) {
  state.tuning.push({ role, text });
  renderTuningLog();
  queueProjectSave();
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
  const listedNames = [];
  const listedMatches = script.matchAll(/(^|\n)\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}|[\u4e00-\u9fa5]{2,4})[，,]\s*\d{2}岁/g);
  for (const match of listedMatches) listedNames.push(match[2].trim());
  if (listedNames.length) return [...new Set(listedNames)].slice(0, 5);

  const colonMatches = script.matchAll(/(^|\n)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z ._-]{1,28})[:：]/g);
  for (const match of colonMatches) {
    const name = match[2].trim();
    if (!["项目", "目标市场", "主要人物", "场景", "对白"].includes(name)) names.add(name);
  }
  return [...names].slice(0, 5);
}

function detectScene(text) {
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
贯穿情感弧线：从当前剧本抽取其阶段性变化与最终走向。
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
  renderProfileCards();
  queueProjectSave();
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
    renderProfileCards();
    queueProjectSave();
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
    return "默认克制、可观测、少空泛形容词；优先微表情、呼吸和手部动作。";
  }
  return userMessages.slice(-4).join("；");
}

function estimateTotalDuration(selectedText) {
  const len = String(selectedText || "").trim().length;
  if (len <= 80) return 5;
  if (len <= 140) return 6.5;
  if (len <= 220) return 8;
  if (len <= 360) return 10;
  if (len <= 520) return 12;
  return 15;
}

function buildDurationSegments(total) {
  const count = total <= 6 ? 2 : total <= 10 ? 3 : 4;
  const base = total / count;
  const segments = [];
  let consumed = 0;
  for (let i = 0; i < count; i += 1) {
    let duration = Math.round(base * 2) / 2;
    if (i === count - 1) duration = Math.round((total - consumed) * 2) / 2;
    consumed += duration;
    segments.push(duration);
  }
  const sum = segments.reduce((acc, value) => acc + value, 0);
  if (sum !== total) {
    segments[segments.length - 1] = Math.round((segments[segments.length - 1] + (total - sum)) * 2) / 2;
  }
  return segments;
}

function formatSeconds(value) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1).replace(/\.0$/, "")}`;
}

function buildLocalPrompt() {
  const selectedText = getSceneSelectionText();
  if (!selectedText) {
    showToast("请先选中一段剧情");
    return "";
  }
  if (!state.profileConfirmed) {
    showToast("请先确认人设");
    return "";
  }

  const market = els.marketSelect.value;
  const sceneType = detectScene(selectedText);
  const template = sceneTemplates[sceneType] || sceneTemplates.auto;
  const emotion = inferEmotion(selectedText);
  const dialogues = extractDialogue(selectedText, market);
  const totalDuration = estimateTotalDuration(selectedText);
  const segments = buildDurationSegments(totalDuration);
  const sceneName = template.sceneName;
  const characters = detectProfileNames().slice(0, 2);
  const refs = characters.map((name) => `@${name} 为角色参考`).join(" ");
  const dialogueFallback = market === "domestic" ? "无" : "None";
  const style = template.style;
  const understanding = [
    `这场戏位于当前冲突正在被公开放大的节点，前文积累的压力在此处集中显形，后续将把人物关系推向更明确的对抗或松动。`,
    `在场人物此刻的关系温度并不稳定：表面维持体面，内里却有人在强撑、有人在试探或施压。`,
    `生成的分镜应始终围绕这种“嘴上收着、身体泄漏”的状态展开，不能写成脱离剧情的通用表演。`
  ].join("");
  const selectedClean = selectedText.replace(/\s+/g, " ").slice(0, 100);

  const lines = segments.map((duration, index) => {
    const shotNo = index + 1;
    const dialogue = dialogues[index] || (index === 0 && dialogues[0]) || "";
    const shotLanguage = [
      "竖屏中近景固定镜头，35mm，浅景深",
      "竖屏近景轻微推进，50mm，浅景深",
      "竖屏中景固定镜头，35mm，景深自然",
      "竖屏近景固定镜头，50mm，浅景深"
    ][index] || "竖屏中近景固定镜头，35mm，浅景深";
    const subjectLabel = characters[0] || "角色A";
    const action = `${subjectLabel}：整体姿态保持克制站立或微停，重心轻微变化；头部先稳住再出现极小转动；眼神/表情表现为${emotion.face}；手部动作表现为${emotion.body}；细节通过停顿、慢眨眼或指节发力泄漏情绪。`;
    const environment = `场景环境：空间保持现实氛围，人物与所选剧情“${selectedClean}”对应，不额外增加无关人物。`;
    const sound = `音效：环境底噪、衣料摩擦、呼吸声、细小动作音。`;
    const dialogueLine = market === "domestic"
      ? `台词：${dialogue ? `"${dialogue}"（语气克制，音量中低，开口前微停顿）` : "无"}。`
      : `台词：${dialogue ? `"${dialogue}"（语气克制，音量中低，开口前微停顿）` : "无"}。`;
    return `分镜${shotNo}：${shotLanguage}。${action}${environment}${sound}${dialogueLine}时长：${formatSeconds(duration)}s`;
  }).join("\n\n");

  return `@${sceneName}（室内/现实光线） 为场景参考 ${refs || "@角色A 为角色参考"}。根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。

${lines}

风格：${style}
约束：保持原剧情顺序推进；情绪变化按冲突自然累积；全段不增加其他人物；动作自然、口型准确、无穿模、无闪烁；${getTuningSummary()}
场景理解：${understanding}
设计说明：本地简化版依据所选文本长度估算总时长约 ${formatSeconds(totalDuration)}s，并按 ${segments.length} 个分镜拆分，重点保留 ${template.conflict}`;
}

function buildLocalPromptVariants() {
  const base = buildLocalPrompt();
  if (!base) return;
  state.currentVariants = [];
  state.activeVariantId = "";
  state.adoptedVariantId = "";
  state.revisionChatHistory = [];

  registerVariant(base, "local", "策略A", "稳妥平衡版");
  registerVariant(transformLocalVariant(base, "restrained"), "local", "策略B", "更克制、更收敛");
  registerVariant(transformLocalVariant(base, "subtext"), "local", "策略C", "更强潜台词与身体泄漏");

  applyVariant(state.currentVariants[0].id);
  els.generationError.hidden = true;
  els.localGenerateBtn.hidden = true;
  renderRevisionChatLog();
  showToast("已生成 3 个本地对比版本");
}

async function buildPromptVariants() {
  const selectedText = getSceneSelectionText();
  if (!selectedText) {
    showToast("请先选中一段剧情");
    return;
  }
  if (!state.profileConfirmed) {
    showToast("请先确认人设");
    return;
  }

  const restore = setBusy(els.generateVariantsBtn, true, "生成 3 版中");
  try {
    state.currentVariants = [];
    state.activeVariantId = "";
    state.adoptedVariantId = "";
    state.revisionChatHistory = [];
    renderRevisionChatLog();

    if (!state.aiConfigured) {
      buildLocalPromptVariants();
      return;
    }

    const selectionRange = state.contextSelectionRange || state.sceneSelectionRange || {};
    const payload = await requestJson("/api/generate-prompt-variants", {
      method: "POST",
      body: JSON.stringify({
        script: els.scriptInput.value,
        selectedText,
        selectionRange: {
          start: Number(selectionRange.start || 0),
          end: Number(selectionRange.end || 0)
        },
        profile: els.profileInput.value,
        market: els.marketSelect.value,
        sceneType: "auto",
        duration: "auto",
        tuning: state.tuning,
        directing: getSceneDirectingOptions(),
        modelConfig: getModelConfigForRequest()
      })
    }).catch(() => null);

    if (payload && Array.isArray(payload.variants) && payload.variants.length) {
      payload.variants.slice(0, 3).forEach((item, idx) => {
        registerVariant(item.prompt || "", "ai", item.label || `策略${String.fromCharCode(65 + idx)}`, item.strategy || item.note || "");
      });
    } else {
      const strategies = [
        { label: "策略A", extra: "请生成最稳妥、最适合直接投 Seedance 2.0 的版本。", strategy: "稳妥平衡版" },
        { label: "策略B", extra: "请优先做克制细腻版：少外露，多用呼吸、眼神、手部和停顿承载情绪。", strategy: "更克制、更收敛" },
        { label: "策略C", extra: "请优先强化潜台词：嘴上说的和身体泄漏的要形成张力，减少解释性对白。", strategy: "更强潜台词与身体泄漏" }
      ];

      for (const item of strategies) {
        const result = await requestJson("/api/generate-prompt", {
          method: "POST",
          body: JSON.stringify({
            script: els.scriptInput.value,
            selectedText,
            selectionRange: {
              start: Number(selectionRange.start || 0),
              end: Number(selectionRange.end || 0)
            },
            profile: els.profileInput.value,
            market: els.marketSelect.value,
            sceneType: "auto",
            duration: "auto",
            tuning: [...state.tuning, { role: "user", text: item.extra }],
            directing: getSceneDirectingOptions(),
            modelConfig: getModelConfigForRequest()
          })
        });
        registerVariant(result.prompt || "", "ai", item.label, item.strategy);
      }
    }

    if (state.currentVariants[0]) applyVariant(state.currentVariants[0].id);
    els.generationError.hidden = true;
    els.localGenerateBtn.hidden = true;
    queueProjectSave();
    showToast("已生成 3 个 AI 版本");
  } catch (error) {
    els.generationError.hidden = false;
    els.generationError.textContent = `AI 多版本生成失败：${error.message}。可先用本地 3 版对比做方向判断。`;
    els.localGenerateBtn.hidden = false;
    showToast("AI 多版本生成失败");
  } finally {
    restore();
    refreshAiStatus();
  }
}

async function revisePrompt() {
  const targetVariant = (state.currentVariants || []).find((item) => item.id === state.adoptedVariantId) || state.currentVariants?.[0];
  if (!targetVariant) {
    showToast("请先生成一个 Prompt");
    return;
  }
  if (!state.revisionChatHistory.length) {
    showToast("请先在下方对话里讨论改稿方向");
    return;
  }

  const restore = setBusy(els.revisePromptBtn, true, "改稿中");
  try {
    const selectedText = getSceneSelectionText();
    const payload = await requestJson("/api/revise-prompt", {
      method: "POST",
      body: JSON.stringify({
        script: els.scriptInput.value,
        selectedText,
        selectionRange: state.contextSelectionRange || state.sceneSelectionRange || null,
        profile: els.profileInput.value,
        market: els.marketSelect.value,
        currentPrompt: String(targetVariant.prompt || "").trim(),
        instruction: "请根据以下完整对话共识进行改稿。",
        history: state.revisionChatHistory,
        directing: getSceneDirectingOptions(),
        modelConfig: getModelConfigForRequest()
      })
    });
    const prompt = payload.prompt || "";
    targetVariant.prompt = prompt;
    targetVariant.source = "ai";
    state.adoptedVariantId = targetVariant.id;
    state.activeVariantId = targetVariant.id;
    state.revisionChatHistory.push({ role: "system", text: "已按共识改稿" });
    els.promptQuality.textContent = "AI 已改稿并采用";
    els.promptQuality.classList.add("is-ok");
    updatePromptCheckSummary(prompt);
    renderVariantList();
    renderRevisionChatLog();
    queueProjectSave();
    showToast("定向改稿已完成");
  } catch (error) {
    showToast(`改稿失败：${error.message}`);
  } finally {
    restore();
    refreshAiStatus();
  }
}

function computeContextWindow(script, range) {
  const start = Math.max(0, range.start ?? range.currentStart ?? 0);
  const end = Math.min(script.length, range.end ?? range.currentEnd ?? 0);
  const ctxStart = Math.max(0, start - 1500);
  const ctxEnd = Math.min(script.length, end + 1500);
  return {
    start,
    end,
    ctxStart,
    ctxEnd,
    before: script.slice(ctxStart, start),
    selected: script.slice(start, end),
    after: script.slice(end, ctxEnd)
  };
}

function renderScriptContextView() {
  const container = els.scriptContextView;
  if (!container) return;
  const script = els.scriptInput.value || "";
  const range = state.sceneSelectionRange;
  if (!script.trim() || !range) {
    container.innerHTML = '<div class="empty-state">选择场次后，这里会显示上下文。你可以直接在这里划词选择更精确的生成范围。</div>';
    hideFloatingGenerateButton();
    return;
  }

  const context = computeContextWindow(script, range);
  container.innerHTML = `<div class="context-block" data-context-start="${context.ctxStart}">${escapeHtml(context.before)}<mark class="is-selected">${escapeHtml(context.selected)}</mark>${escapeHtml(context.after)}</div>`;
}

async function inferPromptEditPreference(variantId) {
  const variant = (state.currentVariants || []).find((item) => item.id === variantId);
  if (!variant) return;
  const before = String(variant.originalPrompt || "").trim();
  const after = String(variant.prompt || "").trim();
  if (!before || !after || before === after) return;

  try {
    const payload = await requestJson("/api/tune", {
      method: "POST",
      body: JSON.stringify({
        message: `请根据下面“生成前后 Prompt 差异”总结 2-4 条可复用偏好规则，写给后续生成使用。\n\n原版本：\n${before.slice(0, 8000)}\n\n手改后：\n${after.slice(0, 8000)}`,
        history: state.tuning,
        modelConfig: getModelConfigForRequest()
      })
    });
    const reply = payload.reply || "后续生成向本次手改靠拢。";
    addMessage("ai", reply);
    state.tuning.push({ role: "user", text: `从我的手改中学习：${reply}` });
    variant.preferenceRecorded = true;
    queueProjectSave();
    renderVariantList();
  } catch {
    // 静默失败
  }
}

function buildFreshProjectData({ projectId = "", projectName = "未命名项目", market = "overseas" } = {}) {
  const fresh = createEmptyState();
  fresh.projectId = projectId;
  fresh.currentStep = projectId ? "script" : "home";
  return {
    projectName,
    market,
    script: "",
    profile: "",
    prompt: "",
    state: fresh
  };
}

function applyProjectPayload(payload) {
  const normalized = payload || buildFreshProjectData();
  state = normalizeLoadedState({ ...(normalized.state || {}), projectId: normalized.id || normalized.state?.projectId || state.projectId || "" });
  els.projectName.value = normalized.projectName || "未命名项目";
  els.marketSelect.value = normalized.market || "overseas";
  els.scriptInput.value = normalized.script || "";
  els.profileInput.value = normalized.profile || "";
  els.modelInput.value = state.modelConfig?.model || "";
  els.baseUrlInput.value = state.modelConfig?.baseUrl || "";
  els.apiKeyInput.value = sessionStorage.getItem(MODEL_KEY_STORAGE) || "";
  els.fileStatus.textContent = "PDF / DOCX / DOC / TXT / MD，解析后会填入编辑器";

  hideFloatingGenerateButton();
  renderTuningLog();
  renderSceneCandidates();
  renderProfileCards();
  updateProfileState();
  updateSelectionCount({ rerenderContext: true });
  updatePromptCheckSummary("");
  renderVariantList();
  renderRevisionChatLog();
  setStep(state.currentStep || "script", { silent: true });
  updateWorkflowStatus();
  persistProjectLocally(false);
}

function resetProject() {
  const name = els.homeNewProjectName?.value.trim() || "未命名项目";
  const market = els.homeNewProjectMarket?.value || "overseas";
  state = normalizeLoadedState({ ...createEmptyState(), projectId: "", currentStep: "home" });
  applyProjectPayload(buildFreshProjectData({ projectName: name, market }));
  setStep("home", { silent: true });
}

function updatePromptCheckSummary(prompt = "") {
  const adopted = (state.currentVariants || []).find((item) => item.id === state.adoptedVariantId);
  const text = String(prompt || adopted?.prompt || "").trim();

  if (!text) {
    els.promptCheckSummary.classList.remove("is-ok", "is-warn");
    els.promptCheckSummary.innerHTML = "<strong>等待生成</strong><span>生成后这里会显示当前采用状态。</span>";
    updateWorkflowStatus();
    return;
  }

  const adoptedLabel = adopted?.label || "某版本";
  els.promptCheckSummary.classList.add("is-ok");
  els.promptCheckSummary.classList.remove("is-warn");
  els.promptCheckSummary.innerHTML = `<strong>当前采用：${escapeHtml(adoptedLabel)}</strong><span>编辑任一版本即自动切换采用对象，并在 2 秒后静默分析你的手改偏好。</span>`;
  updateWorkflowStatus();
}

function hideFloatingGenerateButton() {
  if (!els.floatingGenerateBtn) return;
  els.floatingGenerateBtn.classList.remove("is-visible");
  els.floatingGenerateBtn.hidden = true;
  els.floatingGenerateBtn.style.left = "";
  els.floatingGenerateBtn.style.top = "";
  latestSelectionSnapshot = null;
}

function queuePreferenceInference(variant) {
  if (!variant) return;
  window.clearTimeout(variant._prefTimer);
  variant.preferenceRecorded = false;
  variant._prefTimer = window.setTimeout(() => inferPromptEditPreference(variant.id), 2000);
}

function getContextSelectionFromDom() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!els.scriptContextView.contains(range.commonAncestorContainer)) return null;

  const contextBlock = els.scriptContextView.querySelector("[data-context-start]");
  if (!contextBlock) return null;
  const contextStart = Number(contextBlock.dataset.contextStart || 0);
  const selectedText = range.toString();
  if (!selectedText.trim()) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(contextBlock);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;
  const endOffset = startOffset + selectedText.length;

  return {
    start: contextStart + startOffset,
    end: contextStart + endOffset,
    text: selectedText
  };
}

function captureSelectionSnapshot() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!els.scriptContextView.contains(range.commonAncestorContainer)) return null;
  const selection = getContextSelectionFromDom();
  if (!selection) return null;
  const rect = range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return null;
  return { selection, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } };
}

function updateContextSelectionFromSnapshot(snapshot, showButton = true) {
  if (!snapshot?.selection) {
    if (!showButton) hideFloatingGenerateButton();
    return null;
  }
  const selection = snapshot.selection;
  state.contextSelectionRange = { start: selection.start, end: selection.end };
  state.sceneSelection = selection.text.trim();
  state.sceneSelectionRange = { start: selection.start, end: selection.end };
  state.floatingSelection = { start: selection.start, end: selection.end, text: selection.text.trim() };
  updateSelectionCount({ rerenderContext: false });
  if (showButton) {
    positionFloatingGenerateButton(snapshot.rect);
  } else {
    renderScriptContextView();
  }
  queueProjectSave();
  return selection;
}

function positionFloatingGenerateButton(rect) {
  if (!els.floatingGenerateBtn || !rect) return;
  const wrapRect = els.scriptContextView.parentElement.getBoundingClientRect();
  const left = Math.max(8, Math.min(wrapRect.width - 170, rect.right - wrapRect.left - 140));
  const top = Math.max(8, rect.bottom - wrapRect.top + 10);
  els.floatingGenerateBtn.style.left = `${left}px`;
  els.floatingGenerateBtn.style.top = `${top}px`;
  if (els.floatingGenerateBtn.hidden) {
    els.floatingGenerateBtn.hidden = false;
    window.requestAnimationFrame(() => els.floatingGenerateBtn.classList.add("is-visible"));
  }
}

function handleContextSelectionGesture() {
  const snapshot = captureSelectionSnapshot();
  latestSelectionSnapshot = snapshot;
  if (!snapshot) {
    hideFloatingGenerateButton();
    return;
  }
  updateContextSelectionFromSnapshot(snapshot, true);
}

function extractProfileBlockById(raw, characterId) {
  const blocks = parseProfileBlocks(raw);
  const found = blocks.find((block) => parseProfileFields(block.raw)["人物ID"] === characterId);
  return found ? found.raw : "";
}

function replaceProfileBlockById(raw, characterId, nextBlockRaw) {
  const blocks = parseProfileBlocks(raw).map((block) => block.raw);
  const nextBlocks = blocks.map((block) => {
    const fields = parseProfileFields(block);
    return fields["人物ID"] === characterId ? String(nextBlockRaw || "").trim() : block;
  });
  return nextBlocks.join("\n\n---\n\n");
}

function openProfileModal(characterId) {
  const blockRaw = extractProfileBlockById(els.profileInput.value, characterId);
  if (!blockRaw || !els.profileModal) return;
  state.profileModalCharacterId = characterId;
  els.profileModal.hidden = false;
  renderProfileModal();
  renderProfileChatLog();
  window.setTimeout(() => els.profileChatInput?.focus(), 0);
}

function closeProfileModal() {
  if (els.profileModal) els.profileModal.hidden = true;
  state.profileModalCharacterId = "";
}

function renderProfileModal() {
  const characterId = state.profileModalCharacterId;
  if (!characterId) return;
  const fields = parseProfileFields(extractProfileBlockById(els.profileInput.value, characterId));
  if (els.profileModalTitle) els.profileModalTitle.textContent = `${characterId} · 人物详情`;

  const visibleFields = ["人物小传", "性格底色", "关系动力学", "贯穿情感弧线", "专属表演习惯Tell"];
  els.profileModalBody.innerHTML = visibleFields.map((fieldName) => `
    <div class="profile-field">
      <span>${escapeHtml(fieldName)}</span>
      <div class="profile-field-value">${escapeHtml(fields[fieldName] || "未填写")}</div>
    </div>
  `).join("");
}

function renderProfileChatLog() {
  const characterId = state.profileModalCharacterId;
  const history = state.profileChatHistories?.[characterId] || [];
  if (!els.profileChatLog) return;
  els.profileChatLog.innerHTML = history.length
    ? history.map((message) => `<div class="message ${message.role === "user" ? "user" : "ai"}"><strong>${message.role === "user" ? "你" : "AI 人设编辑器"}</strong><span>${escapeHtml(message.text)}</span></div>`).join("")
    : '<div class="empty-state">还没有对话。试试说：把他改得更隐忍一点。</div>';
  els.profileChatLog.scrollTop = els.profileChatLog.scrollHeight;
}

function getRevisionHistoryKey() {
  return activeProjectId() || "__draft__";
}

function getRevisionHistory() {
  const key = getRevisionHistoryKey();
  if (!state.revisionChatHistories || typeof state.revisionChatHistories !== "object") state.revisionChatHistories = {};
  if (!Array.isArray(state.revisionChatHistories[key])) state.revisionChatHistories[key] = [];
  return state.revisionChatHistories[key];
}

function setRevisionHistory(history) {
  const key = getRevisionHistoryKey();
  if (!state.revisionChatHistories || typeof state.revisionChatHistories !== "object") state.revisionChatHistories = {};
  state.revisionChatHistories[key] = Array.isArray(history) ? history : [];
}

function renderRevisionChatLog() {
  if (!els.revisionChatLog) return;
  const history = getRevisionHistory();
  els.revisionChatLog.innerHTML = history.length
    ? history.map((message) => `<div class="message ${message.role === "user" ? "user" : "ai"}"><strong>${message.role === "user" ? "你" : "AI 改稿讨论助手"}</strong><span>${escapeHtml(message.text)}</span></div>`).join("")
    : '<div class="empty-state">先聊清楚要怎么改，再点“按指令改稿”。例如：这段别太满，女主先稳住体面，再从慢眨眼和手腕发力里泄漏刺痛。</div>';
  els.revisionChatLog.scrollTop = els.revisionChatLog.scrollHeight;
}

function appendRevisionChat(role, text) {
  const history = getRevisionHistory();
  history.push({ role, text: String(text || "").trim() });
  setRevisionHistory(history.slice(-20));
  renderRevisionChatLog();
  saveState(false);
}

function clearRevisionChat(showMessage = false) {
  setRevisionHistory([]);
  renderRevisionChatLog();
  saveState(false);
  if (showMessage) showToast("已清空改稿对话");
}

async function submitRevisionChat(messageText = "") {
  const targetVariant = (state.currentVariants || []).find((item) => item.id === state.adoptedVariantId) || state.currentVariants?.[0];
  const currentPrompt = String(targetVariant?.prompt || "").trim();
  if (!currentPrompt) {
    showToast("请先生成并采用一个版本");
    return;
  }
  const userMessage = String(messageText || els.reviseChatInput?.value || "").trim();
  if (!userMessage) {
    showToast("先输入你想调整的方向");
    return;
  }

  appendRevisionChat("user", userMessage);
  if (els.reviseChatInput) els.reviseChatInput.value = "";

  const restore = setBusy(els.reviseChatSendBtn, true, "讨论中");
  try {
    const payload = await requestJson("/api/revise-chat", {
      method: "POST",
      body: JSON.stringify({
        currentPrompt,
        selectedText: getSceneSelectionText(),
        profile: els.profileInput.value,
        history: getRevisionHistory(),
        message: userMessage,
        market: els.marketSelect.value,
        modelConfig: getModelConfigForRequest()
      })
    });
    appendRevisionChat("ai", payload.reply || "我理解了，可以继续补充你想保留和想删掉的部分。");
  } catch (error) {
    appendRevisionChat("ai", `讨论失败：${error.message}`);
    showToast(`讨论失败：${error.message}`);
  } finally {
    restore();
    refreshAiStatus();
  }
}

async function applyRevisionFromChat() {
  const targetVariant = (state.currentVariants || []).find((item) => item.id === state.adoptedVariantId) || state.currentVariants?.[0];
  const currentPrompt = String(targetVariant?.prompt || "").trim();
  if (!currentPrompt) {
    showToast("请先生成一个 Prompt");
    return;
  }

  const history = getRevisionHistory().filter((item) => item && item.text);
  if (!history.length) {
    showToast("先聊几轮改稿方向，再执行改稿");
    return;
  }

  const instruction = history.map((item) => `${item.role === "user" ? "用户" : "AI"}：${item.text}`).join("\n");
  const restore = setBusy(els.reviseApplyBtn, true, "改稿中");
  try {
    const payload = await requestJson("/api/revise-prompt", {
      method: "POST",
      body: JSON.stringify({
        script: els.scriptInput.value,
        selectedText: getSceneSelectionText(),
        selectionRange: state.sceneSelectionRange,
        profile: els.profileInput.value,
        market: els.marketSelect.value,
        currentPrompt,
        instruction,
        directing: getSceneDirectingOptions(),
        modelConfig: getModelConfigForRequest()
      })
    });
    const prompt = payload.prompt || "";
    targetVariant.prompt = prompt;
    targetVariant.source = "ai";
    state.adoptedVariantId = targetVariant.id;
    state.activeVariantId = targetVariant.id;
    els.promptQuality.textContent = "AI 已按共识改稿并采用";
    els.promptQuality.classList.add("is-ok");
    updatePromptCheckSummary(prompt);
    renderVariantList();
    appendRevisionChat("ai", "已按共识改稿");
    saveState(false);
    showToast("已按对话共识完成改稿");
  } catch (error) {
    showToast(`改稿失败：${error.message}`);
  } finally {
    restore();
    refreshAiStatus();
  }
}

async function submitProfileChat() {
  const characterId = state.profileModalCharacterId;
  const instruction = String(els.profileChatInput?.value || "").trim();
  if (!characterId || !instruction) return;

  state.profileChatHistories[characterId] = state.profileChatHistories[characterId] || [];
  state.profileChatHistories[characterId].push({ role: "user", text: instruction });
  renderProfileChatLog();
  els.profileChatInput.value = "";

  const restore = setBusy(els.profileChatSendBtn, true, "发送中");
  try {
    const payload = await requestJson("/api/profile-chat", {
      method: "POST",
      body: JSON.stringify({
        script: els.scriptInput.value,
        profile: els.profileInput.value,
        characterId,
        characterBlock: extractProfileBlockById(els.profileInput.value, characterId),
        instruction,
        market: els.marketSelect.value,
        history: state.profileChatHistories[characterId],
        modelConfig: getModelConfigForRequest()
      })
    });

    if (payload.updatedBlock) {
      els.profileInput.value = replaceProfileBlockById(els.profileInput.value, characterId, payload.updatedBlock);
      state.profileConfirmed = false;
      updateProfileState();
      renderProfileCards();
      renderProfileModal();
      saveState(false);
    }

    state.profileChatHistories[characterId].push({ role: "ai", text: payload.changeNote || "已完成修改。" });
    renderProfileChatLog();
    showToast("人设已更新");
  } catch (error) {
    state.profileChatHistories[characterId].push({ role: "ai", text: `修改失败：${error.message}` });
    renderProfileChatLog();
    showToast(`人设修改失败：${error.message}`);
  } finally {
    restore();
    refreshAiStatus();
  }
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
    state.sceneSelection = "";
    state.sceneSelectionRange = null;
    state.contextSelectionRange = null;
    state.profileConfirmed = false;
    renderSceneCandidates();
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

els.homeCreateBtn?.addEventListener("click", () => {
  createProjectOnServer().then((project) => {
    if (project) openProjectByMeta(project);
  });
});

els.backToHomeBtn?.addEventListener("click", () => {
  setStep("home", { silent: true });
  renderProjectList();
});

els.newProjectBtn.addEventListener("click", async () => {
  const project = await createProjectOnServer();
  if (project) openProjectByMeta(project);
});
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
  if (!els.projectName.value.trim()) els.projectName.value = "Hidden Vows";
  state.sceneSelection = "";
  renderSceneCandidates();
  const firstCandidate = splitSceneCandidates(els.scriptInput.value)[0];
  if (firstCandidate) selectSceneCandidate(firstCandidate, 0);
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
  state.sceneSelection = "";
  state.sceneSelectionRange = null;
  state.contextSelectionRange = null;
  state.profileConfirmed = false;
  renderSceneCandidates();
  updateProfileState();
  saveState(false);
});
els.profileInput.addEventListener("input", () => {
  state.profileConfirmed = false;
  updateProfileState();
  renderProfileCards();
  saveState(false);
});
els.marketSelect.addEventListener("change", () => saveState(false));
els.projectName.addEventListener("input", () => {
  els.railProjectName.textContent = els.projectName.value.trim() || "未命名项目";
  saveState(false);
});
els.saveModelBtn.addEventListener("click", () => saveModelSettings(true));
els.settingsBtn.addEventListener("click", () => { els.settingsDrawer.hidden = false; });
els.closeSettingsBtn.addEventListener("click", () => { els.settingsDrawer.hidden = true; });
els.manualSelectBtn.addEventListener("click", () => {
  els.scriptInput.focus();
  showToast("请在剧本编辑器中选中完整场次");
});
els.stepButtons.forEach((button) => button.addEventListener("click", () => setStep(button.dataset.step)));
els.requirements.forEach((button) => button.addEventListener("click", () => setStep(button.dataset.requirement)));
document.querySelectorAll("[data-next-step]").forEach((button) => button.addEventListener("click", () => setStep(button.dataset.nextStep)));
document.querySelectorAll("[data-prev-step]").forEach((button) => button.addEventListener("click", () => setStep(button.dataset.prevStep)));
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
els.generateVariantsBtn?.addEventListener("click", () => {
  els.generationError.hidden = true;
  if (state.aiConfigured) buildPromptVariants();
  else buildLocalPromptVariants();
});

els.localGenerateBtn.addEventListener("click", buildLocalPromptVariants);

els.floatingGenerateBtn?.addEventListener("click", () => {
  const snapshot = latestSelectionSnapshot || captureSelectionSnapshot();
  hideFloatingGenerateButton();
  if (!snapshot) {
    showToast("请先在上下文中选中文本");
    return;
  }
  updateContextSelectionFromSnapshot(snapshot, false);
  if (state.aiConfigured) buildPromptVariants();
  else buildLocalPromptVariants();
});

els.scriptContextView?.addEventListener("mouseup", () => {
  window.setTimeout(handleContextSelectionGesture, 0);
});
els.scriptContextView?.addEventListener("keyup", () => {
  window.setTimeout(handleContextSelectionGesture, 0);
});
document.addEventListener("mousedown", (event) => {
  if (!els.floatingGenerateBtn?.hidden && !els.floatingGenerateBtn.contains(event.target) && !els.scriptContextView.contains(event.target)) {
    hideFloatingGenerateButton();
  }
});

els.closeProfileModalBtn?.addEventListener("click", closeProfileModal);
els.profileModal?.addEventListener("click", (event) => {
  if (event.target === els.profileModal) closeProfileModal();
});
els.profileChatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitProfileChat();
});

els.reviseChatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitRevisionChat();
});
els.reviseApplyBtn?.addEventListener("click", applyRevisionFromChat);
els.reviseClearBtn?.addEventListener("click", () => clearRevisionChat(true));
els.quickReviseBtns?.forEach((button) => {
  button.addEventListener("click", () => submitRevisionChat(button.dataset.revise || ""));
});

[els.sceneSearchInput, els.sceneEpisodeInput, els.sceneSearchInputWorkbench, els.sceneEpisodeInputWorkbench]
  .filter(Boolean)
  .forEach((input) => input.addEventListener("input", renderSceneCandidates));

refreshProjects().finally(() => {
  loadState();
  renderTuningLog();
  renderSceneCandidates();
  renderProfileCards();
  updateProfileState();
  updateSelectionCount();
  updatePromptCheckSummary();
  renderScriptContextView();
  renderVariantList();
  renderRevisionChatLog();
  refreshAiStatus();
});