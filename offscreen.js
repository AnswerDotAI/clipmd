const td = new TurndownService({ codeBlockStyle: "fenced" });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "convertMarkdown") {
    try {
      const markdown = td.turndown(msg.html || "");
      sendResponse({ ok: true, markdown });
    } catch (err) {
      console.error(err);
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  }
});
