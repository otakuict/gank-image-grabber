import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

test("nginx-style prefix stripping serves the UI and API under /image-grabber/", async (t) => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const server = spawn(process.execPath, ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(() => server.kill());
  const [output] = await once(server.stdout, "data");
  const upstream = output.toString().match(/http:\/\/localhost:(\d+)/)[0];
  const proxy = createServer(async (req, res) => {
    const response = await fetch(`${upstream}${req.url.slice("/image-grabber".length)}`);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  t.after(() => proxy.close());
  const pageUrl = `http://127.0.0.1:${proxy.address().port}/image-grabber/`;

  const page = await fetch(pageUrl);
  assert.equal(page.status, 200);
  const html = await page.text();
  const scriptPath = html.match(/<script src="([^"]+)"/)[1];
  const scriptUrl = new URL(scriptPath, pageUrl);
  assert.equal(scriptUrl.pathname, "/image-grabber/app.js");
  const script = await fetch(scriptUrl);
  assert.equal(script.status, 200);
  assert.match(await script.text(), /fetch\(`api\/extract\?/);

  const health = await fetch(new URL("health", pageUrl));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  const api = await fetch(new URL("api/extract", pageUrl));
  assert.equal(api.status, 400);
  assert.equal((await api.json()).error, "Missing url query parameter.");

  for (const file of ["server.js", "package.json", "missing.js", ".git/config"]) {
    const response = await fetch(new URL(file, pageUrl));
    assert.equal(response.status, 404, file);
  }
});
