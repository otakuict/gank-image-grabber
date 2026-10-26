const seller = process.argv[2];
const nondatedOnly = process.argv.includes("--nondated");
const terms = process.argv.slice(3).filter((term) => term !== "--nondated").map((term) => term.toLowerCase());
if (!seller || (!terms.length && !nondatedOnly)) throw new Error("Usage: find_seller_posts.mjs <seller> <term>... [--nondated]");

const headers = { accept: "application/json", "user-agent": "Mozilla/5.0" };
const profileResponse = await fetch(`https://api.ganknow.com/v1/users/nickname/${seller}?timezone=7`, { headers });
if (!profileResponse.ok) throw new Error(`Profile request failed: ${profileResponse.status}`);
const profile = (await profileResponse.json()).data;

const perPage = 200;
const firstResponse = await fetch(`https://api.ganknow.com/v1/posts?author=${profile.id}&page=1&perPage=${perPage}`, { headers });
if (!firstResponse.ok) throw new Error(`Posts request failed: ${firstResponse.status}`);
const first = await firstResponse.json();
const pageCount = Math.ceil((first.metadata?.total ?? first.data?.length ?? 0) / perPage);
const pages = [first];
for (let page = 2; page <= pageCount; page++) {
  const response = await fetch(`https://api.ganknow.com/v1/posts?author=${profile.id}&page=${page}&perPage=${perPage}`, { headers });
  if (!response.ok) throw new Error(`Posts page ${page} failed: ${response.status}`);
  pages.push(await response.json());
}

const normalize = (value = "") => value
  .replace(/&#34;|&quot;/gi, '"')
  .replace(/&amp;/gi, "&")
  .replace(/&#39;|&apos;/gi, "'")
  .toLowerCase();
const matches = pages.flatMap((page) => page.data ?? []).filter((post) => {
  const haystack = normalize(`${post.title ?? ""} ${post.content ?? ""}`);
  const textMatches = terms.every((term) => haystack.includes(term));
  const dateMatches = !nondatedOnly || !/\b\d{6}\b/.test(haystack);
  return textMatches && dateMatches;
}).map((post) => ({
  seller,
  title: post.title,
  content: post.content,
  createdAt: post.createdAt,
  url: `https://ganknow.com/post/${post.id}`,
}));

console.log(JSON.stringify({ seller, postCount: pages.flatMap((page) => page.data ?? []).length, terms, matches }, null, 2));
