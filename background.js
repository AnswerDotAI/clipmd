const OFFSCREEN_URL = "offscreen.html";
const PROTOCOL_VERSION = "1.3";
const highlightConfig = {
  borderColor: { r: 111, g: 168, b: 220, a: 0.9 },
  contentColor: { r: 111, g: 168, b: 220, a: 0.35 },
  showInfo: true
};

const sessions = new Map();

const ensureOffscreen = async () => {
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: "Copy selected element as Markdown or image"
    });
  } catch (err) {
    if (!/existing/i.test(err?.message || "")) throw err;
  }
};

const send = (debuggee, method, params = {}) =>
  new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(debuggee, method, params, result => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(result);
    });
  });

const detach = async debuggee => {
  try {
    await send(debuggee, "Overlay.setInspectMode", { mode: "none" });
  } catch (_) {}
  try {
    await chrome.debugger.detach(debuggee);
  } catch (_) {}
};

const startSession = async (tabId, mode) => {
  if (sessions.has(tabId)) return;
  await ensureOffscreen();
  const debuggee = { tabId };
  try {
    await chrome.debugger.attach(debuggee, PROTOCOL_VERSION);
    await send(debuggee, "DOM.enable");
    await send(debuggee, "Overlay.enable");
    if (mode === "screenshot" || mode === "html") await send(debuggee, "Page.enable");
    sessions.set(tabId, { debuggee, mode });
    await send(debuggee, "Overlay.setInspectMode", {
      mode: "searchForNode",
      highlightConfig
    });
  } catch (err) {
    sessions.delete(tabId);
    await detach(debuggee);
    console.error(err);
  }
};

const sendToOffscreen = msg =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, res => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(res);
    });
  });

const writeTextToTab = async (tabId, text) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [text],
    func: async content => {
      await navigator.clipboard.writeText(content);
    }
  });
};

const captureAndCrop = async (debuggee, backendNodeId) => {
  const { model } = await send(debuggee, "DOM.getBoxModel", { backendNodeId });
  const { cssLayoutViewport: vp } = await send(debuggee, "Page.getLayoutMetrics");
  const pts = model.border;
  const x = Math.min(pts[0], pts[2], pts[4], pts[6]);
  const y = Math.min(pts[1], pts[3], pts[5], pts[7]);
  const width = Math.max(pts[0], pts[2], pts[4], pts[6]) - x;
  const height = Math.max(pts[1], pts[3], pts[5], pts[7]) - y;
  const { data } = await send(debuggee, "Page.captureScreenshot", { format: "png" });
  const res = await fetch(`data:image/png;base64,${data}`);
  const img = await createImageBitmap(await res.blob());
  const sx = img.width / vp.clientWidth, sy = img.height / vp.clientHeight;
  const canvas = new OffscreenCanvas(width * sx, height * sy);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x * sx, y * sy, width * sx, height * sy, 0, 0, width * sx, height * sy);
  return await canvas.convertToBlob({ type: 'image/png' });
};

const blobToBase64 = blob => new Promise(resolve => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.readAsDataURL(blob);
});

const writeBlobToTab = async (tabId, blob) => {
  const b64 = await blobToBase64(blob);
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [b64],
    func: async b64 => {
      const res = await fetch(`data:image/png;base64,${b64}`);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }
  });
};

const writeHtmlAndBlobToTab = async (tabId, html, blob) => {
  const b64 = await blobToBase64(blob);
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [html, b64],
    func: async (htmlContent, b64) => {
      const res = await fetch(`data:image/png;base64,${b64}`);
      const imgBlob = await res.blob();
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "image/png": imgBlob })]);
    }
  });
};

const handleNode = async (session, backendNodeId) => {
  const { debuggee, mode } = session;
  try {
    if (mode === "markdown") {
      const { outerHTML } = await send(debuggee, "DOM.getOuterHTML", { backendNodeId });
      const res = await sendToOffscreen({ type: "convertMarkdown", html: outerHTML });
      if (!res?.ok) throw new Error(res?.error || "Markdown conversion failed");
      await writeTextToTab(debuggee.tabId, res.markdown);
    } else if (mode === "screenshot") {
      const blob = await captureAndCrop(debuggee, backendNodeId);
      await writeBlobToTab(debuggee.tabId, blob);
    } else if (mode === "html") {
      const { outerHTML } = await send(debuggee, "DOM.getOuterHTML", { backendNodeId });
      const blob = await captureAndCrop(debuggee, backendNodeId);
      await writeHtmlAndBlobToTab(debuggee.tabId, outerHTML, blob);
    }
  } catch (err) {
    console.error(err);
  } finally {
    sessions.delete(debuggee.tabId);
    await detach(debuggee);
  }
};

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method !== "Overlay.inspectNodeRequested" || !params?.backendNodeId) return;
  const session = sessions.get(source.tabId);
  if (!session) return;
  handleNode(session, params.backendNodeId);
});

chrome.debugger.onDetach.addListener(source => {
  sessions.delete(source.tabId);
});

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const run = async (mode, tab) => {
  const target = tab?.id ? tab : await getActiveTab();
  if (!target?.id) return;
  await startSession(target.id, mode);
};

chrome.action.onClicked.addListener(tab => run("markdown", tab));

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "_execute_action") run("markdown", tab);
  if (command === "clipmd-screenshot") run("screenshot", tab);
  if (command === "clipmd-html") run("html", tab);
});
