// Playwright MCP serveriga qo'lda initialize + tools/list yuborib, sog'lomligini tekshiradi.
const { spawn } = require("child_process");
const path = require("path");

const CLI = "C:\\Users\\user\\.config\\opencode\\node_modules\\@playwright\\mcp\\cli.js";

const p = spawn("node", [CLI], { stdio: ["pipe", "pipe", "pipe"] });
let out = "";
let err = "";
p.stdout.on("data", (d) => { out += d.toString(); });
p.stderr.on("data", (d) => { err += d.toString(); });

function send(obj) {
  const s = JSON.stringify(obj) + "\n";
  p.stdin.write(s);
}

setTimeout(() => {
  console.log("=== 1) initialize ===");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" },
  }});
}, 500);

setTimeout(() => {
  console.log("=== 2) initialized ===");
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}, 2000);

setTimeout(() => {
  console.log("=== STDOUT (javob) ===");
  console.log(out.slice(0, 2500) || "(bo'sh)");
  console.log("\n=== STDERR (xato) ===");
  console.log(err.slice(0, 1500) || "(bo'sh)");

  // javobdan asosiy ma'lumot
  for (const line of out.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const m = JSON.parse(line);
      if (m.id === 1) console.log("\ninitialize muvaffaqiyatli:", JSON.stringify(m.result?.serverInfo || m.error).slice(0, 200));
      if (m.id === 2) {
        const names = (m.result?.tools || []).map((t) => t.name);
        console.log("topilgan vositalar:", names.length);
        names.slice(0, 25).forEach((n) => console.log("  -", n));
      }
    } catch {}
  }
  p.kill();
  process.exit(0);
}, 5000);
