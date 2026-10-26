const serviceSampleUrl = "https://ganknow.com/services/89471-yoichi69-260329-belle";
const postSampleUrl = "https://ganknow.com/post/6bca17eb-6b2e-494f-8d44-c3634d49c34d";

const form = document.querySelector("#grab-form");
const urlInput = document.querySelector("#service-url");
const grabButton = document.querySelector("#grab-button");
const serviceSampleButton = document.querySelector("#service-sample-button");
const postSampleButton = document.querySelector("#post-sample-button");
const copyAllButton = document.querySelector("#copy-all-button");
const statusNode = document.querySelector("#status");
const summaryNode = document.querySelector("#summary");
const resultsNode = document.querySelector("#results");
const bulkBoxNode = document.querySelector("#bulk-box");
const bulkOutputNode = document.querySelector("#bulk-output");

serviceSampleButton.addEventListener("click", () => {
  urlInput.value = serviceSampleUrl;
  urlInput.focus();
});

postSampleButton.addEventListener("click", () => {
  urlInput.value = postSampleUrl;
  urlInput.focus();
});

copyAllButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(bulkOutputNode.value);
    setStatus("Copied all original URLs.", false);
  } catch {
    setStatus("Clipboard write failed. You can still copy from the text box.", true);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const value = urlInput.value.trim();
  if (!value) {
    setStatus("Enter a Gank service or post URL first.", true);
    return;
  }

  setLoading(true);
  setStatus("Fetching page and extracting image media...", false);
  clearResults();

  try {
    const response = await fetch(`/api/extract?url=${encodeURIComponent(value)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Extraction failed.");
    }

    renderResults(payload);
    setStatus(`Loaded ${payload.imageCount} carousel image${payload.imageCount === 1 ? "" : "s"}.`, false);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Extraction failed.", true);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  grabButton.disabled = isLoading;
  grabButton.textContent = isLoading ? "Working..." : "Grab Images";
}

function setStatus(message, isError) {
  statusNode.textContent = message;
  statusNode.classList.toggle("error", isError);
}

function clearResults() {
  resultsNode.innerHTML = "";
  summaryNode.hidden = true;
  summaryNode.innerHTML = "";
  bulkBoxNode.hidden = true;
  bulkOutputNode.value = "";
}

function renderResults(payload) {
  const { pageType, title, sourceUrl, images } = payload;

  summaryNode.hidden = false;
  summaryNode.innerHTML = [
    `<div class="summary-chip">${escapeHtml(toTitleCase(pageType))}: <strong>${escapeHtml(title)}</strong></div>`,
    `<div class="summary-chip">Images: <strong>${images.length}</strong></div>`,
    `<div class="summary-chip"><a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noreferrer">Open source page</a></div>`,
  ].join("");

  bulkBoxNode.hidden = false;
  bulkOutputNode.value = images.map((image) => image.originalUrl).join("\n");

  for (const image of images) {
    const article = document.createElement("article");
    article.className = "card";

    article.innerHTML = `
      <img class="thumb" src="${escapeAttribute(image.originalUrl)}" alt="Carousel image ${image.index}">
      <div class="card-body">
        <p class="eyebrow">${image.isPrimary ? "Primary image" : "Carousel image"}</p>
        <div class="title-row">
          <h2>Image ${image.index}</h2>
          <span id="size-${image.index}">Loading size...</span>
        </div>
        <p class="meta">
          <strong>Rendered URL:</strong> ${escapeHtml(shorten(image.renderedUrl))}<br>
          <strong>Original URL:</strong> ${escapeHtml(shorten(image.originalUrl))}
        </p>
        <div class="actions">
          <a href="${escapeAttribute(image.originalUrl)}" target="_blank" rel="noreferrer">Open Original</a>
          <button class="ghost" type="button" data-copy="${escapeAttribute(image.originalUrl)}">Copy URL</button>
        </div>
      </div>
    `;

    article.querySelector("[data-copy]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(image.originalUrl);
        setStatus(`Copied Image ${image.index} original URL.`, false);
      } catch {
        setStatus("Clipboard write failed.", true);
      }
    });

    resultsNode.append(article);
    hydrateDimensions(image, article.querySelector(`#size-${image.index}`));
  }
}

async function hydrateDimensions(image, node) {
  const dimensions = await getImageSize(image.originalUrl);
  if (!node) {
    return;
  }

  node.textContent = dimensions
    ? `${dimensions.width}x${dimensions.height}`
    : "Size unavailable";
}

function getImageSize(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function shorten(value, max = 64) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}...`;
}

function toTitleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
