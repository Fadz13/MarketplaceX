const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  envVars[key] = value;
}

// Run vitest with env vars
const testFile = process.argv[2] || "__tests__/order-integration-supabase.test.ts";
const cmd = `npx vitest run ${testFile}`;

const env = { ...process.env, ...envVars };
try {
  const output = execSync(cmd, {
    cwd: path.join(__dirname, ".."),
    env,
    stdio: "inherit",
    timeout: 120000,
  });
} catch (e) {
  process.exit(e.status || 1);
}
