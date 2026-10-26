import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { writeFile } from "node:fs/promises";

const xlsxPath = process.argv[2];
if (!xlsxPath) throw new Error("xlsx path required");

const sellers = ["idolxdata", "kdatastudio", "yoichi69", "idollove", "loveshakedata", "datacoffeeshop"];
const aliases = new Map([
  ["은채", "eunchae"], ["홍은채", "eunchae"], ["윤진", "yunjin"], ["카즈하", "kazuha"],
  ["류진", "ryujin"], ["아테나", "athena"], ["조이", "joy"], ["비니", "minnie"],
  ["leeso", "leeseo"], ["lesserafim", "le sserafim"],
]);
const stop = new Set(["preview", "pics", "files", "rare", "limited", "exclusive", "special", "collection", "event", "prize", "ver", "version", "section", "data", "set", "coffee", "backview", "super", "full", "album", "pictures", "pic", "dont", "know", "date", "solo", "light", "black", "pink", "kd", "yoichi", "yoichi69", "idolxdata", "kdatastudio", "idollove", "loveshakedata", "datacoffeeshop"]);
const manualOverrides = new Map([
  ["260613 yubin 2", {
    seller: "idolxdata",
    title: "🎆Sold Out🎆 260613 YUBIN 3108 PICS",
    url: "https://ganknow.com/post/07fd3dba-7329-454d-9f1a-615fcf090a1c",
  }],
  ["260711 chaewon backview collection", {
    seller: "idollove",
    title: "260711 CHAEWON🚨LIMITED🚨",
    url: "https://ganknow.com/post/1d90ef3d-a686-444e-90fb-9aefcc404c1a",
  }],
]);

function decodeHtml(value = "") {
  return value.replace(/&#34;|&quot;/gi, '"').replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function normalize(value = "") {
  let text = decodeHtml(value).toLowerCase();
  for (const [from, to] of aliases) text = text.replaceAll(from, ` ${to} `);
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2").replace(/[^a-z0-9가-힣]+/g, " ").trim().replace(/\bcoffe\b/g, "coffee").replace(/\s+/g, " ");
}

function dateOf(value) {
  return normalize(value).match(/(?:^|\s)(\d{6})(?:\s|$)/)?.[1] ?? null;
}

function otherNumbers(value, date) {
  return [...normalize(value).matchAll(/\b\d+\b/g)].map(m => m[0]).filter(n => n !== date);
}

function words(value) {
  return normalize(value).split(" ").filter(w => w.length > 1 && !/^\d+$/.test(w) && !stop.has(w));
}

async function getProfile(seller) {
  const response = await fetch(`https://api.ganknow.com/v1/users/nickname/${seller}?timezone=7`, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`${seller} profile ${response.status}`);
  return (await response.json()).data;
}

async function getPosts(seller, author) {
  const perPage = 200;
  const first = await getPage(1);
  const total = first.metadata?.total ?? first.data?.length ?? 0;
  const pages = Math.ceil(total / perPage);
  const rest = [];
  for (let page = 2; page <= pages; page++) rest.push(await getPage(page));
  return [first, ...rest].flatMap(result => result.data ?? []).map(post => ({
    seller,
    id: post.id,
    title: decodeHtml(post.title ?? ""),
    content: decodeHtml(post.content ?? ""),
    createdAt: post.createdAt,
    url: `https://ganknow.com/post/${post.id}`,
  }));

  async function getPage(page) {
    const params = new URLSearchParams({ author, page: String(page), perPage: String(perPage) });
    const response = await fetch(`https://api.ganknow.com/v1/posts?${params}`, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`${seller} posts page ${page}: ${response.status}`);
    return response.json();
  }
}

const input = await FileBlob.load(xlsxPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItemAt(0);
const usedValues = sheet.getUsedRange(true).values;
const lastSourceRow = usedValues.reduce(
  (last, row, index) => (String(row?.[0] ?? "").trim() ? index : last),
  0,
);
const rows = usedValues.slice(0, lastSourceRow + 1).map((row) => [row?.[0], row?.[1]]);
const profiles = await Promise.all(sellers.map(getProfile));
const postGroups = await Promise.all(profiles.map((profile, i) => getPosts(sellers[i], profile.id)));
const posts = postGroups.flat();

const output = [];
for (let i = 1; i < rows.length; i++) {
  const target = String(rows[i]?.[0] ?? "").trim();
  const group = String(rows[i]?.[1] ?? "").trim();
  const targetDate = dateOf(target);
  const nums = otherNumbers(target, targetDate);
  const versionNumber = /\(\s*(\d{1,2})\s*\)/.exec(target)?.[1] ?? null;
  const groupWords = [...new Set(words(group))];
  const targetWords = [...new Set(words(target).filter(word => !groupWords.includes(word)))];
  const normalizedTarget = normalize(target);
  const sellerHint = sellers.find(seller => normalizedTarget.includes(seller))
    ?? (normalizedTarget.includes("yoichi") ? "yoichi69" : null)
    ?? (/\brare kd\b|\bkd\b/.test(normalizedTarget) ? "kdatastudio" : null);
  const modifiers = [
    ["backview", /backview/], ["coffee", /coffee/], ["section a", /section a/],
    ["event prize", /event prize/], ["exclusive", /exclusive/], ["special limited", /special.*limited|limited.*special/],
    ["super rare", /super.*rare|rare.*super/],
  ].filter(([needle]) => normalizedTarget.includes(needle));
  const rankedCandidates = posts.map(post => {
    const hay = normalize(`${post.title} ${post.content}`);
    const titleNorm = normalize(post.title);
    const hasDate = targetDate ? new RegExp(`(?:^| )${targetDate}(?: |$)`).test(hay) : false;
    const matchedNums = nums.filter(n => new RegExp(`(?:^| )${n}(?: |$)`).test(hay));
    const matchedWords = targetWords.filter(w => new RegExp(`(?:^| )${w}(?: |$)`).test(hay));
    const matchedGroup = groupWords.filter(w => new RegExp(`(?:^| )${w}(?: |$)`).test(hay));
    let score = 0;
    if (hasDate) score += 80;
    score += matchedNums.length * 35;
    score += matchedWords.length * 18;
    score += matchedGroup.length * 4;
    if (targetWords.length && matchedWords.length === targetWords.length) score += 25;
    if (nums.length && matchedNums.length === nums.length) score += 30;
    if (/backview/.test(normalize(target)) && /backview/.test(hay)) score += 25;
    if (/coffee/.test(normalize(target)) && /coffee/.test(hay)) score += 25;
    if (/section a/.test(normalize(target)) && /section a/.test(hay)) score += 30;
    if (/event prize/.test(normalize(target)) && /event prize/.test(hay)) score += 30;
    if (/exclusive/.test(normalize(target)) && /exclusive/.test(hay)) score += 15;
    if (/special limited/.test(normalize(target)) && /special/.test(hay) && /limited/.test(hay)) score += 20;
    return { ...post, score, hasDate, matchedNums, matchedWords, matchedGroup, titleNorm };
  }).filter(c => targetDate ? c.hasDate : true)
    .sort((a, b) => b.score - a.score || b.matchedWords.length - a.matchedWords.length || a.title.localeCompare(b.title));
  const candidates = rankedCandidates.slice(0, 5);

  const baseExact = rankedCandidates.filter(c => {
    const titleHay = normalize(c.title);
    const rawTitle = decodeHtml(c.title).toLowerCase();
    const titleHasDate = targetDate ? new RegExp(`(?:^| )${targetDate}(?: |$)`).test(titleHay) : false;
    const titleHasIdentity = targetWords.length
      ? targetWords.every(w => new RegExp(`(?:^| )${w}(?: |$)`).test(titleHay))
      : groupWords.some(w => new RegExp(`(?:^| )${w}(?: |$)`).test(titleHay));
    const versionMatches = !versionNumber || new RegExp(`(?:\\(\\s*${versionNumber}\\s*\\)|(?:ver|version)\\s*${versionNumber}(?:\\b|$))`, "i").test(rawTitle);
    return targetDate && c.hasDate &&
    titleHasDate && titleHasIdentity && versionMatches &&
    targetWords.every(w => c.matchedWords.includes(w)) &&
    (!sellerHint || c.seller === sellerHint) &&
    modifiers.every(([, regex]) => regex.test(normalize(`${c.title} ${c.content}`)));
  });
  const strict = baseExact.filter(c => nums.every(n => c.matchedNums.includes(n)));
  const dedicatedRanked = baseExact.map(c => ({
    candidate: c,
    extraIdentityWords: words(c.title).filter(w => !targetWords.includes(w) && !groupWords.includes(w)),
  })).sort((a, b) => a.extraIdentityWords.length - b.extraIdentityWords.length);
  const dedicated = dedicatedRanked.length > 1 && dedicatedRanked[0].extraIdentityWords.length === 0 && dedicatedRanked[1].extraIdentityWords.length > 0
    ? dedicatedRanked[0].candidate
    : null;
  let decision;
  const manualOverride = manualOverrides.get(normalizedTarget);
  if (manualOverride) {
    decision = { status: "matched", ...manualOverride, manuallyVerified: true };
  } else if (!targetDate) {
    decision = { status: "remark", remark: "Missing exact 6-digit date in column A" };
  } else if (strict.length === 1) {
    decision = { status: "matched", seller: strict[0].seller, title: strict[0].title, url: strict[0].url };
  } else if (strict.length > 1) {
    decision = { status: "remark", remark: `Ambiguous: ${strict.length} exact candidates`, exactCandidates: strict.map(c => ({ seller: c.seller, title: c.title, content: c.content, url: c.url })) };
  } else if (baseExact.length === 1 && targetWords.length > 0) {
    decision = { status: "matched", seller: baseExact[0].seller, title: baseExact[0].title, url: baseExact[0].url, numberOmittedByGank: nums.length > 0 };
  } else if (dedicated) {
    decision = { status: "matched", seller: dedicated.seller, title: dedicated.title, url: dedicated.url, numberOmittedByGank: nums.length > 0, preferredDedicatedTitle: true };
  } else if (baseExact.length > 1) {
    decision = { status: "remark", remark: `Ambiguous: ${baseExact.length} same-date/name candidates`, exactCandidates: baseExact.map(c => ({ seller: c.seller, title: c.title, content: c.content, url: c.url })) };
  } else {
    decision = { status: "remark", remark: nums.length ? `No post matched exact date/name/number (${nums.join(", ")})` : "No unique post matched exact date/name/details", nearest: candidates.slice(0, 3).map(c => ({ seller: c.seller, title: c.title, url: c.url, matchedNums: c.matchedNums, matchedWords: c.matchedWords })) };
  }
  output.push({ row: i + 1, target, group, targetDate, requiredNumbers: nums, versionNumber, targetWords, sellerHint, modifiers: modifiers.map(([name]) => name), decision });
}

const rowFilter = Number(process.argv.find(arg => arg.startsWith("--row="))?.split("=")[1] ?? 0);
if (rowFilter) output.splice(0, output.length, ...output.filter(item => item.row === rowFilter));
const minimal = process.argv.includes("--minimal");
const remarkText = (decision) => {
  const candidates = decision.exactCandidates ?? [];
  if (!candidates.length) return decision.remark;
  return `${decision.remark} | Candidates: ${candidates.map(c => `${c.seller} ${c.url}`).join(" | ")}`;
};
if (process.argv.includes("--tsv")) {
  const tsv = output.map(({ decision }) => decision.status === "matched"
    ? `${decision.seller}\t${decision.url}\t`
    : `\t\t${remarkText(decision)}`).join("\n");
  const tsvOutput = process.argv.find(arg => arg.startsWith("--tsv-output="))?.slice("--tsv-output=".length);
  if (tsvOutput) await writeFile(tsvOutput, tsv, "utf8");
  else console.log(tsv);
  process.exit(0);
}
const resultRows = minimal
  ? output.map(({ row, target, decision }) => decision.status === "matched"
    ? { row, target, status: "matched", seller: decision.seller, url: decision.url }
    : { row, target, status: "remark", remark: decision.remark })
  : process.argv.includes("--compact") ? output.map(({ row, target, decision }) => ({ row, target, decision })) : output;
const result = { sellerPostCounts: Object.fromEntries(postGroups.map((items, i) => [sellers[i], items.length])), totalPosts: posts.length, matched: output.filter(r => r.decision.status === "matched").length, remarks: output.filter(r => r.decision.status === "remark").length, rows: resultRows };
console.log(JSON.stringify(result, null, 2));
