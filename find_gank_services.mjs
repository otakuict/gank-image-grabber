const seller = process.argv[2];
const terms = process.argv.slice(3).map((term) => term.toLowerCase());

if (!seller || !terms.length) {
  throw new Error("Usage: find_gank_services.mjs <seller> <term>...");
}

const headers = { accept: "application/json", "user-agent": "Mozilla/5.0" };
const profileResponse = await fetch(`https://api.ganknow.com/v1/users/nickname/${seller}?timezone=7`, { headers });
if (!profileResponse.ok) throw new Error(`Profile lookup failed: ${profileResponse.status}`);
const profile = (await profileResponse.json()).data;

const modes = [{ label: "all", extra: "" }];

const results = [];
for (const mode of modes) {
  for (let page = 1; page <= 2; page += 1) {
    const url = `https://api.ganknow.com/v1/catalogs/services?userId=${profile.id}&page=${page}&per_page=100&order_by=createdAt%20desc${mode.extra}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      results.push({ mode: mode.label, page, error: response.status });
      break;
    }
    const body = await response.json();
    const items = Array.isArray(body.data) ? body.data : [];
    for (const item of items) {
      const text = JSON.stringify(item).toLowerCase();
      if (terms.every((term) => text.includes(term))) {
        results.push({
          mode: mode.label,
          page,
          item: {
            name: item.name,
            slug: item.slug,
            isActive: item.isActive,
            description: item.description,
          },
        });
      }
    }
    if (items.length === 0) break;
  }
}

console.log(JSON.stringify({ seller, userId: profile.id, matches: results }, null, 2));
