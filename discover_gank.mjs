const url = process.argv[2] ?? "https://ganknow.com/yoichi69";
const html = await fetch(url).then((response) => response.text());
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)/g)].map((match) => match[1]);
const htmlContexts = [];
for (const pattern of (process.argv.slice(3).length ? process.argv.slice(3) : ["axios:{"])) {
  const at = html.indexOf(pattern);
  if (at !== -1) htmlContexts.push(html.slice(Math.max(0, at - 500), Math.min(html.length, at + pattern.length + 1000)));
}
const findings = [];
for (const script of scripts.filter((source) => source.startsWith("/_nuxt/"))) {
  const source = await fetch(new URL(script, url)).then((response) => response.text());
  const patterns = process.argv.slice(3).length ? process.argv.slice(3) : ["/posts?", "getGeneralPosts", "pinned-post"];
  const contexts = [];
  for (const pattern of patterns) {
    let start = 0;
    while ((start = source.indexOf(pattern, start)) !== -1) {
      contexts.push(source.slice(Math.max(0, start - 1200), Math.min(source.length, start + pattern.length + 800)));
      start += pattern.length;
      if (contexts.length >= 100) break;
    }
  }
  if (contexts.length) findings.push({ script, length: source.length, contexts: [...new Set(contexts)].slice(0, 100) });
}
console.log(JSON.stringify({ length: html.length, htmlContexts, scripts, findings }, null, 2));
