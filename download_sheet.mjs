import { writeFile } from "node:fs/promises";

const url = "https://docs.google.com/spreadsheets/d/1z45mKRtLvTZth8b-uhqkMyjzxVtHI8b7YVcySQVeEkg/export?format=xlsx&gid=0";
const output = process.argv[2] ?? "LIMITED_RARE_SET_verified.xlsx";
const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
if (!response.ok) throw new Error(`Sheet export failed: ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.length < 1000) throw new Error(`Sheet export was unexpectedly small: ${bytes.length} bytes`);
await writeFile(output, bytes);
console.log(JSON.stringify({ output, bytes: bytes.length, contentType: response.headers.get("content-type") }));
