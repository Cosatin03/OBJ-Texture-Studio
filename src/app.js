const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const studio = window.TextureStudio;

const toolNames = {
  brush: "Pinsel", pencil: "Stift", eraser: "Radierer", fill: "Füllen",
  picker: "Pipette", spray: "Spray", line: "Linie", rect: "Rechteck",
  ellipse: "Ellipse", gradient: "Verlauf", text: "Text"
};
const settingIds = [
  "brushColor", "brushSize", "brushOpacity", "brushHardness", "fillTolerance",
  "shapeFill", "textInput", "fontFamily", "textSize", "textAngle", "textBold",
  "textItalic", "textOutline", "textFlipX", "textFlipY", "showUV", "paint3D",
  "backfacePaint", "seamSafe", "texSize"
];
let projectName = "Unbenanntes Projekt";
let saveTimer;
let toastTimer;
let textureZoom = 1;

function showToast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2100);
}

function setProjectName(name) {
  projectName = (name || "Unbenanntes Projekt").replace(/\.(obj|tms\.json|json)$/i, "");
  $("#projectName").textContent = projectName;
}

function setDirty(dirty = true) {
  $("#savedDot").style.background = dirty ? "#ffb45c" : "#66d9a1";
  $("#savedDot").style.boxShadow = dirty ? "0 0 8px #ffb45c" : "0 0 8px #66d9a1";
}

function openDrawer() {
  $("#exportDrawer").classList.add("open");
  $("#exportDrawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("visible");
}

function closeDrawer() {
  $("#exportDrawer").classList.remove("open");
  $("#exportDrawer").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("visible");
}

$("#exportToggle").addEventListener("click", openDrawer);
$("#exportClose").addEventListener("click", closeDrawer);
$("#scrim").addEventListener("click", closeDrawer);

const importToggle = $("#importToggle");
const importMenu = $("#importMenu");
importToggle.addEventListener("click", event => {
  event.stopPropagation();
  importMenu.hidden = !importMenu.hidden;
  importToggle.setAttribute("aria-expanded", String(!importMenu.hidden));
});
document.addEventListener("click", event => {
  if (!event.target.closest(".menu-wrap")) {
    importMenu.hidden = true;
    importToggle.setAttribute("aria-expanded", "false");
  }
});

$$('[data-view]').forEach(button => button.addEventListener("click", () => {
  const view = button.dataset.view;
  document.body.dataset.view = view;
  $$('.segmented [data-view]').forEach(item => item.classList.toggle("active", item === button));
  $("#canvasWrap").classList.toggle("ai-mode", view === "ai");
  $("#texturePaneTitle").textContent = view === "ai" ? "AI Texture Preview" : "Texturemap";
  if (view === "ai") paintAiPreview(); else studio.renderUVOverlay();
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}));

window.addEventListener("texturestudio:tool", event => {
  $("#activeToolName").textContent = toolNames[event.detail.tool] || event.detail.tool;
});

const brushColor = $("#brushColor");
const colorHex = $("#colorHex");
brushColor.addEventListener("input", () => colorHex.value = brushColor.value.toUpperCase());
colorHex.addEventListener("change", () => {
  if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
    brushColor.value = colorHex.value;
    brushColor.dispatchEvent(new Event("input", { bubbles: true }));
  } else colorHex.value = brushColor.value.toUpperCase();
});

$("#imageQuality").addEventListener("input", event => {
  $("#imageQualityValue").textContent = `${event.target.value}%`;
});

function updateDimensions() {
  $("#textureDimensions").textContent = `${studio.tex.width} × ${studio.tex.height}`;
}

function canvasBlob(canvas, type = "image/png", quality = .92) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function downloadCanvas(canvas, baseName, type, quality) {
  const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const blob = await canvasBlob(canvas, type, quality);
  studio.downloadBlob(`${baseName}.${extensions[type] || "png"}`, blob);
}

function selectedImageOptions() {
  return {
    type: $("#imageFormat").value,
    quality: Number($("#imageQuality").value) / 100
  };
}

function drawUvLines(ctx, width, { color = "#34a9ff", lineWidth = 1.4, labels = false } = {}) {
  const mesh = studio.getMesh();
  if (!mesh) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth * width / 1024);
  ctx.lineJoin = "round";
  for (let i = 0; i < mesh.count; i += 3) {
    ctx.beginPath();
    for (let corner = 0; corner < 3; corner++) {
      const x = mesh.uv[(i + corner) * 2] * width;
      const y = mesh.uv[(i + corner) * 2 + 1] * width;
      corner ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  if (labels) {
    ctx.fillStyle = "rgba(8,12,18,.75)";
    ctx.font = `${Math.max(9, width / 100)}px DM Mono, monospace`;
    mesh.surfaces.forEach((triangles, surfaceIndex) => {
      const tri = triangles[0] * 3;
      const x = (mesh.uv[tri * 2] + mesh.uv[(tri + 1) * 2] + mesh.uv[(tri + 2) * 2]) / 3 * width;
      const y = (mesh.uv[tri * 2 + 1] + mesh.uv[(tri + 1) * 2 + 1] + mesh.uv[(tri + 2) * 2 + 1]) / 3 * width;
      ctx.fillText(String(surfaceIndex + 1), x, y);
    });
  }
  ctx.restore();
}

function islandColor(index, alpha = 1) {
  const hue = (index * 137.508 + 12) % 360;
  return `hsla(${hue}, 74%, 58%, ${alpha})`;
}

function createIslandMask(size = studio.tex.width, transparent = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!transparent) {
    ctx.fillStyle = "#080b10";
    ctx.fillRect(0, 0, size, size);
  }
  const mesh = studio.getMesh();
  if (!mesh) return canvas;
  for (let i = 0; i < mesh.count; i += 3) {
    const surface = mesh.triSurface[Math.floor(i / 3)];
    ctx.fillStyle = islandColor(surface);
    ctx.beginPath();
    for (let corner = 0; corner < 3; corner++) {
      const x = mesh.uv[(i + corner) * 2] * size;
      const y = mesh.uv[(i + corner) * 2 + 1] * size;
      corner ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

function createUvGuide({ includeTexture = true, includeMask = false, labels = false } = {}) {
  const size = studio.tex.width;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f5f7";
  ctx.fillRect(0, 0, size, size);
  if (includeTexture) ctx.drawImage(studio.tex, 0, 0);
  if (includeMask) {
    ctx.globalAlpha = includeTexture ? .32 : 1;
    ctx.drawImage(createIslandMask(size, true), 0, 0);
    ctx.globalAlpha = 1;
  }
  drawUvLines(ctx, size, { color: includeTexture ? "rgba(10,16,24,.92)" : "#0e63ff", lineWidth: 1.35, labels });
  return canvas;
}

function paintAiPreview() {
  studio.renderUVOverlay();
  if (document.body.dataset.view !== "ai") return;
  const overlay = studio.overlay;
  const ctx = overlay.getContext("2d");
  if ($("#aiLabels").checked) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.globalAlpha = .35;
    ctx.drawImage(createIslandMask(overlay.width, true), 0, 0);
    ctx.restore();
  }
  if (!$("#aiIncludeUV").checked) ctx.clearRect(0, 0, overlay.width, overlay.height);
  studio.tex.style.opacity = $("#aiIncludeTexture").checked ? "1" : "0";
}

["#aiIncludeTexture", "#aiIncludeUV", "#aiLabels"].forEach(id => $(id).addEventListener("change", paintAiPreview));

function drawSheetTile(ctx, source, x, y, size, title, subtitle) {
  ctx.fillStyle = "#161b24";
  ctx.fillRect(x, y, size, size);
  ctx.drawImage(source, x, y, size, size);
  ctx.fillStyle = "rgba(7,10,15,.88)";
  ctx.fillRect(x, y + size - 74, size, 74);
  ctx.fillStyle = "#fff";
  ctx.font = "700 24px Manrope, sans-serif";
  ctx.fillText(title, x + 24, y + size - 39);
  ctx.fillStyle = "#aab2c0";
  ctx.font = "14px Manrope, sans-serif";
  ctx.fillText(subtitle, x + 24, y + size - 17);
}

function createContactSheet() {
  const tile = 900, gutter = 32, header = 180;
  const canvas = document.createElement("canvas");
  canvas.width = tile * 2 + gutter * 3;
  canvas.height = header + tile * 2 + gutter * 3;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#090c11";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff6747";
  ctx.font = "800 18px Manrope, sans-serif";
  ctx.fillText("TEXTUREMAP STUDIO · AI REFERENCE", gutter, 42);
  ctx.fillStyle = "#fff";
  ctx.font = "800 48px Manrope, sans-serif";
  ctx.fillText(projectName, gutter, 102);
  const mesh = studio.getMesh();
  ctx.fillStyle = "#8993a4";
  ctx.font = "18px DM Mono, monospace";
  ctx.fillText(`${studio.tex.width}×${studio.tex.height} · ${mesh ? `${mesh.triangles} TRIANGLES · ${mesh.surfaces.length} ISLANDS` : "TEXTURE ONLY"}`, gutter, 140);
  const x1 = gutter, x2 = gutter * 2 + tile, y1 = header + gutter, y2 = header + gutter * 2 + tile;
  drawSheetTile(ctx, studio.tex, x1, y1, tile, "01 · FINAL TEXTURE", "Color reference — preserve placement");
  drawSheetTile(ctx, createUvGuide({ includeTexture: true }), x2, y1, tile, "02 · UV GUIDE", "Do not cross black island borders");
  drawSheetTile(ctx, createIslandMask(tile), x1, y2, tile, "03 · ISLAND ID MASK", "Keep each color region semantically consistent");
  const modelCanvas = document.createElement("canvas");
  modelCanvas.width = modelCanvas.height = tile;
  const modelCtx = modelCanvas.getContext("2d");
  modelCtx.fillStyle = "#0b0e14";
  modelCtx.fillRect(0, 0, tile, tile);
  const gl = studio.glCanvas;
  const aspect = gl.width / Math.max(1, gl.height);
  const drawW = aspect >= 1 ? tile : tile * aspect;
  const drawH = aspect >= 1 ? tile / aspect : tile;
  modelCtx.drawImage(gl, (tile - drawW) / 2, (tile - drawH) / 2, drawW, drawH);
  drawSheetTile(ctx, modelCanvas, x2, y2, tile, "04 · 3D CONTEXT", "Use shape and orientation as context");
  return canvas;
}

$("#saveImage").addEventListener("click", async () => {
  const { type, quality } = selectedImageOptions();
  await downloadCanvas(studio.tex, `${projectName}_texture`, type, quality);
  showToast("Texturemap exportiert");
});
$("#saveUvGuide").addEventListener("click", async () => {
  await downloadCanvas(createUvGuide({ includeTexture: true }), `${projectName}_uv-guide`, "image/png", 1);
  showToast("UV Guide exportiert");
});
$("#saveIslandMask").addEventListener("click", async () => {
  if (!studio.getMesh()) return showToast("Für die Island Mask zuerst ein OBJ laden");
  await downloadCanvas(createIslandMask(), `${projectName}_island-mask`, "image/png", 1);
  showToast("Island ID Mask exportiert");
});
async function exportContactSheet() {
  await downloadCanvas(createContactSheet(), `${projectName}_ai-reference`, "image/png", 1);
  showToast("AI Reference Sheet exportiert");
}
$("#saveContactSheet").addEventListener("click", exportContactSheet);
$("#exportAiSheet").addEventListener("click", exportContactSheet);

function collectSettings() {
  return Object.fromEntries(settingIds.map(id => {
    const node = document.getElementById(id);
    return [id, node.type === "checkbox" ? node.checked : node.value];
  }));
}

function applySettings(settings = {}) {
  Object.entries(settings).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (!node) return;
    if (node.type === "checkbox") node.checked = Boolean(value); else node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
  colorHex.value = brushColor.value.toUpperCase();
}

function projectData() {
  return {
    format: "TextureMap Studio Project",
    version: 2,
    createdAt: new Date().toISOString(),
    name: projectName,
    view: document.body.dataset.view,
    settings: collectSettings(),
    model: studio.getObjSource() ? { name: studio.getObjName(), obj: studio.getObjSource() } : null,
    texture: { width: studio.tex.width, height: studio.tex.height, dataUrl: studio.tex.toDataURL("image/png") }
  };
}

async function loadProject(data) {
  if (!data || data.format !== "TextureMap Studio Project") throw new Error("Keine gültige TextureMap-Studio-Projektdatei.");
  setProjectName(data.name);
  applySettings(data.settings);
  if (data.model?.obj) await studio.loadOBJText(data.model.obj, data.model.name || `${data.name}.obj`);
  if (data.texture?.dataUrl) await studio.loadTextureDataUrl(data.texture.dataUrl, { push: false });
  const viewButton = $(`.segmented [data-view="${data.view || "split"}"]`);
  if (viewButton) viewButton.click();
  updateDimensions();
  setDirty(false);
  showToast("Projekt geladen");
}

function saveProjectFile() {
  const json = JSON.stringify(projectData(), null, 2);
  studio.downloadBlob(`${projectName}.tms.json`, new Blob([json], { type: "application/json" }));
  setDirty(false);
  showToast("Projektdatei gespeichert");
}
$("#saveProject").addEventListener("click", saveProjectFile);
$("#saveProjectDrawer").addEventListener("click", saveProjectFile);

$("#projectFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try { await loadProject(JSON.parse(await file.text())); }
  catch (error) { studio.status(`Projektfehler: ${error.message}`); }
});

function aiPromptText() {
  const mesh = studio.getMesh();
  return `AI TEXTURE GENERATION BRIEF\n\nProject: ${projectName}\nCanvas: ${studio.tex.width} × ${studio.tex.height}px\nUV islands: ${mesh?.surfaces.length ?? "not available"}\nTriangles: ${mesh?.triangles ?? "not available"}\n\nTASK\nCreate a seamless production-ready color/albedo texture for the supplied 3D model. Use the UV guide and island-ID mask as strict spatial constraints.\n\nRULES\n- Keep all artwork inside its assigned UV island.\n- Never paint across black UV seams.\n- Preserve padding around every island to prevent bleeding.\n- Keep matching object parts stylistically and materially consistent.\n- No lighting, cast shadows, ambient occlusion, highlights or perspective baked into the albedo.\n- Output a flat, orthographic texture map at exactly ${studio.tex.width} × ${studio.tex.height}px.\n- Preserve the original transparency where present.\n\nFILES\n1. *_texture.png — current color reference\n2. *_uv-guide.png — immutable seam boundaries\n3. *_island-mask.png — unique semantic regions\n4. *_ai-reference.png — combined context sheet\n`;
}
$("#savePrompt").addEventListener("click", () => {
  studio.downloadBlob(`${projectName}_ai-brief.txt`, new Blob([aiPromptText()], { type: "text/plain" }));
  showToast("AI Prompt Brief exportiert");
});

function parsePalette(text) {
  const colors = new Set();
  for (const match of text.matchAll(/#[0-9a-f]{6}\b/gi)) colors.add(match[0].toLowerCase());
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
    if (match) colors.add(`#${match.slice(1, 4).map(v => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("")}`);
  }
  return [...colors].slice(0, 32);
}

function installPalette(colors) {
  if (!colors.length) throw new Error("Keine Farben erkannt.");
  const swatches = $("#swatches");
  swatches.replaceChildren();
  colors.forEach(color => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => {
      brushColor.value = color;
      brushColor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    swatches.appendChild(button);
  });
  showToast(`${colors.length} Palettenfarben importiert`);
}

$("#paletteFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try { installPalette(parsePalette(await file.text())); }
  catch (error) { studio.status(`Palettenfehler: ${error.message}`); }
});

async function imageFileToTexture(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  await studio.loadTextureDataUrl(dataUrl);
  updateDimensions();
  showToast(`Textur geladen: ${file.name}`);
}

async function handleFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".obj")) {
    await studio.loadOBJText(await file.text(), file.name);
    setProjectName(file.name);
  } else if (name.endsWith(".tms") || name.endsWith(".json")) {
    await loadProject(JSON.parse(await file.text()));
  } else if (file.type.startsWith("image/")) {
    await imageFileToTexture(file);
  } else if (name.endsWith(".gpl") || name.endsWith(".txt")) {
    installPalette(parsePalette(await file.text()));
  } else throw new Error("Dateityp wird nicht unterstützt.");
}

let dragDepth = 0;
window.addEventListener("dragenter", event => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  dragDepth++;
  $("#dropOverlay").classList.add("visible");
});
window.addEventListener("dragover", event => event.preventDefault());
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $("#dropOverlay").classList.remove("visible");
});
window.addEventListener("drop", async event => {
  event.preventDefault();
  dragDepth = 0;
  $("#dropOverlay").classList.remove("visible");
  for (const file of [...event.dataTransfer.files]) {
    try { await handleFile(file); }
    catch (error) { studio.status(`Importfehler: ${error.message}`); }
  }
});

window.addEventListener("paste", async event => {
  const file = [...event.clipboardData.items].find(item => item.type.startsWith("image/"))?.getAsFile();
  if (file) await imageFileToTexture(file);
});

$("#objFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) setProjectName(file.name);
});
$("#imgFile").addEventListener("change", () => setTimeout(updateDimensions, 160));

$("#fitTexture").addEventListener("click", () => {
  textureZoom = textureZoom === 1 ? .75 : 1;
  $("#uvStage").style.width = `${Math.round(textureZoom * 90)}%`;
  $("#zoomLabel").textContent = `${Math.round(textureZoom * 100)}%`;
});
$("#fullscreenButton").addEventListener("click", async () => {
  if (!document.fullscreenElement) await $(".workspace").requestFullscreen(); else await document.exitFullscreen();
});

const shortcutsDialog = $("#shortcutsDialog");
$("#shortcutsButton").addEventListener("click", () => shortcutsDialog.showModal());
$("[data-close-dialog]").addEventListener("click", () => shortcutsDialog.close());

window.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "s") { event.preventDefault(); saveProjectFile(); }
  if (event.key.toLowerCase() === "e") { event.preventDefault(); openDrawer(); }
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("texturemap-studio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function autosave() {
  try {
    $("#autosaveState").textContent = "Speichert…";
    const db = await openDatabase();
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(projectData(), "autosave");
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    $("#autosaveState").textContent = "Autosave aktuell";
    setDirty(false);
    db.close();
  } catch {
    $("#autosaveState").textContent = "Autosave nicht verfügbar";
  }
}

function scheduleAutosave() {
  setDirty(true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 1400);
}
window.addEventListener("texturestudio:changed", event => {
  if (event.detail?.type === "model" && event.detail.name) setProjectName(event.detail.name);
  updateDimensions();
  scheduleAutosave();
});
settingIds.forEach(id => document.getElementById(id)?.addEventListener("change", scheduleAutosave));

updateDimensions();
colorHex.value = brushColor.value.toUpperCase();
studio.tex.style.opacity = "1";
window.addEventListener("beforeunload", event => {
  if ($("#savedDot").style.background === "rgb(255, 180, 92)") event.preventDefault();
});
