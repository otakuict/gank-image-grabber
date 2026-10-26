const [url, ...args] = process.argv.slice(2);
if (!url) throw new Error("URL required");
const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } });
const text = await response.text();
console.log(response.status, response.statusText);
console.log(text.slice(0, Number(args[0] ?? 20000)));
