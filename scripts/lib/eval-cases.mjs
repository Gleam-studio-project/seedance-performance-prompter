const requiredFields = [
  "id",
  "title",
  "market",
  "sceneType",
  "duration",
  "expectsDialogue",
  "expectsSplit",
  "script",
  "selectedText"
];

export function validateEvalCases(cases) {
  const errors = [];
  if (!Array.isArray(cases)) return { pass: false, errors: ["cases must be an array"], summary: {} };

  const ids = new Set();
  cases.forEach((item, index) => {
    const label = item?.id || `index ${index}`;
    for (const field of requiredFields) {
      if (!(field in (item || {}))) errors.push(`${label}: missing ${field}`);
    }
    if (!item || typeof item !== "object") return;
    if (ids.has(item.id)) errors.push(`${label}: duplicate id`);
    ids.add(item.id);
    if (!/^[a-z0-9-]+$/.test(item.id || "")) errors.push(`${label}: invalid id`);
    if (!new Set(["overseas", "domestic"]).has(item.market)) errors.push(`${label}: invalid market`);
    if (![9, 12, 15].includes(item.duration)) errors.push(`${label}: duration must be 9, 12, or 15`);
    if (typeof item.expectsDialogue !== "boolean") errors.push(`${label}: expectsDialogue must be boolean`);
    if (typeof item.expectsSplit !== "boolean") errors.push(`${label}: expectsSplit must be boolean`);
    if (String(item.script || "").length < 80) errors.push(`${label}: script is too short`);
    if (String(item.selectedText || "").length < 60) errors.push(`${label}: selectedText is too short`);
  });

  const summary = {
    total: cases.length,
    overseas: cases.filter((item) => item.market === "overseas").length,
    domestic: cases.filter((item) => item.market === "domestic").length,
    dialogue: cases.filter((item) => item.expectsDialogue).length,
    silent: cases.filter((item) => !item.expectsDialogue).length,
    split: cases.filter((item) => item.expectsSplit).length,
    durations: Object.fromEntries([9, 12, 15].map((duration) => [duration, cases.filter((item) => item.duration === duration).length]))
  };

  if (summary.total !== 12) errors.push(`expected 12 cases, received ${summary.total}`);
  if (summary.overseas !== 8) errors.push(`expected 8 overseas cases, received ${summary.overseas}`);
  if (summary.domestic !== 4) errors.push(`expected 4 domestic cases, received ${summary.domestic}`);
  if (summary.silent < 2) errors.push("expected at least 2 silent cases");
  if (summary.split < 2) errors.push("expected at least 2 split cases");
  for (const duration of [9, 12, 15]) {
    if (!summary.durations[duration]) errors.push(`duration ${duration} has no cases`);
  }

  return { pass: errors.length === 0, errors, summary };
}
