const postId = process.argv[2];
if (!postId) throw new Error("Usage: inspect_gank_post.mjs <post-id>");

const headers = { accept: "application/json", "user-agent": "Mozilla/5.0" };
const candidates = [
  `https://api.ganknow.com/v1/posts/${postId}`,
  `https://api.ganknow.com/v1/posts/id/${postId}`,
];

for (const url of candidates) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  console.log(JSON.stringify({ url, status: response.status, body: text.slice(0, 20000) }));
  if (response.ok) break;
}
