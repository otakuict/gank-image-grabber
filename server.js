import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(globalThis.process?.env?.PORT ?? "3006", 10);
const allowedHosts = new Set(["ganknow.com", "www.ganknow.com"]);
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const requestUrl = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );

    if (requestUrl.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/api/extract") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== "GET") {
        res.setHeader("Allow", "GET, OPTIONS");
        sendJson(res, 405, { error: "Method not allowed. Use GET." });
        return;
      }

      await handleExtract(requestUrl, res);
      return;
    }

    await handleStatic(requestUrl.pathname, res);
  } catch (error) {
    sendJson(res, 500, {
      error:
        error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}).listen(port, () => {
  console.log(`Gank carousel grabber running at http://localhost:${port}`);
});

async function handleExtract(requestUrl, res) {
  const target = requestUrl.searchParams.get("url")?.trim();
  if (!target) {
    sendJson(res, 400, { error: "Missing url query parameter." });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    sendJson(res, 400, { error: "URL is invalid." });
    return;
  }

  const resourceType = getSupportedGankResourceType(targetUrl);
  if (!resourceType) {
    sendJson(res, 400, {
      error:
        "Only Gank service or post URLs under ganknow.com/services/... or /post/... are supported.",
    });
    return;
  }

  const html = await fetchPage(targetUrl);
  const nuxtData = extractNuxtPayload(html);
  let payload = extractPagePayload(nuxtData, targetUrl, resourceType);

  // Some service pages are rendered entirely on the client and ship an empty
  // Nuxt data entry. In that case, use the same public detail endpoint as the
  // Gank frontend to retrieve the service and its carousel media.
  if (resourceType === "service" && payload.images.length === 0) {
    const service = await fetchServiceBySlug(getResourceSlug(targetUrl));
    if (service) {
      payload = buildServicePayload(service, targetUrl);
    }
  }

  if (!payload || payload.images.length === 0) {
    sendJson(res, 422, {
      error: "No image media found on the page.",
    });
    return;
  }

  sendJson(res, 200, {
    pageType: payload.pageType,
    title: payload.title,
    sourceUrl: targetUrl.toString(),
    imageCount: payload.images.length,
    images: payload.images,
  });
}

async function handleStatic(pathname, res) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  if (!["/index.html", "/app.js"].includes(normalizedPath)) {
    sendJson(res, 404, { error: "Not found." });
    return;
  }
  const relativePath = normalizedPath.replace(/^\/+/, "");
  const filePath = path.resolve(__dirname, relativePath);
  const extension = path.extname(filePath);
  const mimeType = mimeTypes[extension];

  if (!mimeType || !filePath.startsWith(__dirname)) {
    sendJson(res, 404, { error: "Not found." });
    return;
  }

  const file = await readFile(filePath);
  res.writeHead(200, { "Content-Type": mimeType });
  res.end(file);
}

async function fetchPage(targetUrl) {
  const response = await fetch(targetUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": userAgent,
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Upstream request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return response.text();
}

function extractNuxtPayload(html) {
  const match = html.match(/window\.__NUXT__=(.*?);\s*<\/script>/s);
  if (!match) {
    throw new Error("Unable to find Nuxt payload on the page.");
  }

  const sandbox = { window: {} };
  vm.runInNewContext(`window.__NUXT__=${match[1]};`, sandbox, {
    timeout: 1500,
  });
  return sandbox.window.__NUXT__;
}

function extractPagePayload(nuxtData, targetUrl, resourceType) {
  const pageData = Array.isArray(nuxtData?.data) ? nuxtData.data[0] : null;

  if (resourceType === "service") {
    return buildServicePayload(pageData?.service, targetUrl);
  }

  const post = pageData?.post;
  return {
    pageType: "post",
    title: typeof post?.title === "string" ? post.title : targetUrl.pathname,
    images: mapImages(post?.postMedia),
  };
}

function buildServicePayload(service, targetUrl) {
  return {
    pageType: "service",
    title:
      typeof service?.name === "string" ? service.name : targetUrl.pathname,
    images: mapImages(service?.media),
  };
}

async function fetchServiceBySlug(slug) {
  if (!slug) {
    return null;
  }

  const encodedSlug = encodeURIComponent(slug);
  const endpoints = [
    `https://api.ganknow.com/v1/catalogs/services/slug/${encodedSlug}`,
    `https://api.ganknow.com/v1/catalogs/services/slug/${encodedSlug}/old`,
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": userAgent,
      },
    });

    if (!response.ok) {
      continue;
    }

    const body = await response.json();
    if (body?.data && typeof body.data === "object") {
      return body.data;
    }
  }

  return null;
}

function getResourceSlug(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length >= 2 ? segments[1] : "";
}

function mapImages(media) {
  if (!Array.isArray(media)) {
    return [];
  }

  return media
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .filter(
      ({ item }) =>
        item && typeof item.url === "string" && item.type !== "video",
    )
    .sort((left, right) =>
      compareMediaOrder(
        left.item,
        right.item,
        left.sourceIndex,
        right.sourceIndex,
      ),
    )
    .map(({ item }, index) => ({
      index: index + 1,
      type: item.type ?? "unknown",
      renderedUrl: item.url,
      originalUrl: toOriginalGoogleUrl(item.url),
      thumbUrl: typeof item.thumbUrl === "string" ? item.thumbUrl : item.url,
      isPrimary: Boolean(item.isPrimary),
      description: typeof item.description === "string" ? item.description : "",
    }));
}

function compareMediaOrder(left, right, leftIndex, rightIndex) {
  const leftSort = Number.isFinite(left?.sort) ? left.sort : leftIndex;
  const rightSort = Number.isFinite(right?.sort) ? right.sort : rightIndex;
  return leftSort - rightSort;
}

function getSupportedGankResourceType(url) {
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  if (url.pathname.startsWith("/services/")) {
    return "service";
  }

  if (url.pathname.startsWith("/post/")) {
    return "post";
  }

  return null;
}

function toOriginalGoogleUrl(url) {
  if (!url.includes("googleusercontent.com")) {
    return url;
  }

  return /=s\d+(?:-[^/?#]+)?$/i.test(url)
    ? url.replace(/=s\d+(?:-[^/?#]+)?$/i, "=s0")
    : `${url}=s0`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}
