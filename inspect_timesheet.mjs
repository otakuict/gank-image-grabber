import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/timesheet aware/Aware Timesheet - Aug AIS 2026.xlsx";
const previewDir = "outputs/fit-to-one-page-20260903/pre-edit";

await fs.mkdir(previewDir, { recursive: true });
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 10000,
  tableMaxRows: 8,
  tableMaxCols: 10,
  tableMaxCellChars: 100,
});
console.log("OVERVIEW");
console.log(overview.ndjson);

const sheets = workbook.worksheets.items;
for (const sheet of sheets) {
  const used = sheet.getUsedRange();
  console.log(`SHEET ${sheet.name} USED ${used?.address ?? "unknown"}`);
  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const safeName = sheet.name.replace(/[<>:"/\\|?*]/g, "_");
  await fs.writeFile(
    path.join(previewDir, `${safeName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const help = workbook.help("*", {
  search: "pageLayout|pageSetup|printArea|fitToPage|fitToPages",
  include: "index,examples,notes",
  maxChars: 10000,
});
console.log("HELP print/page setup");
console.log(help.ndjson);
