var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_child_process = require("child_process");
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var generationState = {
  status: "idle",
  // 'idle' | 'generating' | 'completed' | 'error'
  totalPages: 1e3,
  minChars: 5e3,
  generatedCount: 0,
  elapsedSec: 0,
  totalMB: 0,
  logs: [],
  error: null
};
var distDir = import_path.default.join(process.cwd(), "dist");
if (!import_fs.default.existsSync(distDir)) {
  import_fs.default.mkdirSync(distDir, { recursive: true });
}
app.get("/api/status", (req, res) => {
  try {
    const files = import_fs.default.readdirSync(distDir).filter((f) => f.endsWith(".html"));
    let totalBytes = 0;
    files.forEach((file) => {
      try {
        const stat = import_fs.default.statSync(import_path.default.join(distDir, file));
        totalBytes += stat.size;
      } catch (e) {
      }
    });
    res.json({
      ...generationState,
      existingFilesCount: files.length,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      sampleFiles: files.slice(0, 50)
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
app.post("/api/generate", (req, res) => {
  if (generationState.status === "generating") {
    return res.status(400).json({ error: "Generation already in progress" });
  }
  const pages = parseInt(req.body.totalPages || "1000", 10);
  const minChars = parseInt(req.body.minChars || "5000", 10);
  generationState = {
    status: "generating",
    totalPages: pages,
    minChars,
    generatedCount: 0,
    elapsedSec: 0,
    totalMB: 0,
    logs: [`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Triggering node build.js ${pages} ${minChars}...`],
    error: null
  };
  const child = (0, import_child_process.spawn)("node", ["build.js", String(pages), String(minChars)], {
    cwd: process.cwd(),
    env: process.env
  });
  child.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      generationState.logs.push(text);
      if (generationState.logs.length > 200) {
        generationState.logs.shift();
      }
      const progressMatch = text.match(/Generated ([\d,]+) \/ ([\d,]+)/);
      if (progressMatch) {
        generationState.generatedCount = parseInt(progressMatch[1].replace(/,/g, ""), 10);
      }
    }
  });
  child.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      generationState.logs.push(`[ERR] ${text}`);
    }
  });
  child.on("close", (code) => {
    if (code === 0) {
      generationState.status = "completed";
      generationState.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \u2705 Build completed successfully!`);
    } else {
      generationState.status = "error";
      generationState.error = `build.js exited with process code ${code}`;
      generationState.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \u274C Build failed with exit code ${code}`);
    }
  });
  res.json({ message: "Generation started", state: generationState });
});
app.get(["/api/preview", "/api/preview/*"], (req, res) => {
  let paramPath = req.params[0] || "index.html";
  if (!paramPath || paramPath === "/") paramPath = "index.html";
  let filePath = import_path.default.join(distDir, paramPath);
  if (!import_fs.default.existsSync(filePath)) {
    if (import_fs.default.existsSync(filePath + ".html")) {
      filePath = filePath + ".html";
    } else if (import_fs.default.existsSync(import_path.default.join(filePath, "index.html"))) {
      filePath = import_path.default.join(filePath, "index.html");
    }
  }
  if (!import_fs.default.existsSync(filePath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <body style="background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; padding: 2rem; background: #1e293b; border-radius: 12px; border: 1px solid #334155;">
            <h2 style="color: #f59e0b;">File Not Found</h2>
            <p>The requested route/file <code>${paramPath}</code> does not exist in <code>dist/</code>.</p>
            <p style="color: #94a3b8;">Click <strong>Execute node build.js</strong> in the control panel to generate HTML pages!</p>
          </div>
        </body>
      </html>
    `);
  }
  res.sendFile(filePath);
});
app.get("/api/code/buildjs", (req, res) => {
  try {
    const buildJsPath = import_path.default.join(process.cwd(), "build.js");
    const code = import_fs.default.readFileSync(buildJsPath, "utf8");
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
app.use("/dist-static", import_express.default.static(distDir));
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(import_express.default.static(distDir));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distDir, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
