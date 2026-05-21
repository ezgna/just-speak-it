const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "run",
  "ios",
  "appleDevice",
  "client",
  "LockdowndClient.js"
);

const before = "debug(`startSession: ${pairRecord}`);";
const after = "debug('startSession');";

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");

if (source.includes(after)) {
  process.exit(0);
}

if (!source.includes(before)) {
  console.warn("[postinstall] Expo CLI patch target was not found; skipping.");
  process.exit(0);
}

fs.writeFileSync(target, source.replace(before, after));
console.log("[postinstall] Patched Expo CLI iOS device handshake logging.");
