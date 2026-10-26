const author = process.argv[2];
const variants = [
  { page: 1, perPage: 5 },
  { page: 2, perPage: 5 },
  { page: 1, per_page: 5 },
  { page: 2, per_page: 5 },
  { author, page: 1, perPage: 100, excludePinned: true },
];
for (const variant of variants) {
  const params = new URLSearchParams({ author, ...variant });
  const response = await fetch(`https://api.ganknow.com/v1/posts?${params}`, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } });
  const json = await response.json();
  console.log(JSON.stringify({ params: Object.fromEntries(params), status: response.status, length: json.data?.length, metadata: json.metadata, titles: json.data?.slice(0, 10).map(p => [p.id, p.title]) }, null, 2));
}
