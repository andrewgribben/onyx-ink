#!/usr/bin/env node
// Evaluates a JS expression in Obsidian's WebView on the Boox over adb (Chrome DevTools protocol).
// Usage: scripts/boox-eval.mjs '<expression>'   e.g. 'app.workspace.activeLeaf.view.surface.view'
// Needs `adb` (ANDROID_SERIAL from scripts/local.env when several devices are attached) and Obsidian open.
import { execFileSync } from "node:child_process";

const expr = process.argv[2];
if (!expr) {
  console.error("usage: boox-eval.mjs '<expression>'");
  process.exit(2);
}
const pid = execFileSync("adb", ["shell", "pidof", "md.obsidian"]).toString().trim();
if (!pid) {
  console.error("Obsidian is not running on the device");
  process.exit(1);
}
const port = "9333";
execFileSync("adb", ["forward", `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`]);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => (ws.onopen = resolve));
ws.onmessage = (message) => {
  const data = JSON.parse(message.data);
  if (data.id !== 1) return;
  const result = data.result?.result;
  if (data.result?.exceptionDetails) {
    console.error(data.result.exceptionDetails.exception?.description ?? data.result.exceptionDetails.text);
    process.exitCode = 1;
  } else {
    console.log(typeof result?.value === "string" ? result.value : JSON.stringify(result?.value, null, 1));
  }
  ws.close();
};
ws.send(JSON.stringify({
  id: 1,
  method: "Runtime.evaluate",
  params: { expression: expr, awaitPromise: true, returnByValue: true },
}));
