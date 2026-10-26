import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("GET extraction API is callable from another origin", async (t) => {
  const port = await getFreePort();
  const server = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  t.after(() => server.kill());

  const endpoint = `http://127.0.0.1:${port}/api/extract`;
  await waitUntilReady(endpoint);

  const preflight = await fetch(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://another-service.example",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
  assert.match(preflight.headers.get("access-control-allow-methods"), /GET/);

  const missingUrl = await fetch(endpoint, {
    headers: { Origin: "https://another-service.example" },
  });
  assert.equal(missingUrl.status, 400);
  assert.equal(missingUrl.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await missingUrl.json(), {
    error: "Missing url query parameter.",
  });

  const unsupportedUrl = await fetch(`${endpoint}?url=${encodeURIComponent("https://example.com/post/123")}`);
  assert.equal(unsupportedUrl.status, 400);

  const wrongMethod = await fetch(endpoint, { method: "POST" });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "GET, OPTIONS");
});

async function getFreePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  listener.close();
  await once(listener, "close");
  return port;
}

async function waitUntilReady(endpoint) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(endpoint);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Server did not start.");
}
