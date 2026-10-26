import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/timesheet aware/Aware Timesheet - Aug AIS 2026.xlsx";
const outputDir = "outputs/fit-to-one-page-20260903";
const outputPath = path.join(outputDir, "Aware Timesheet - Aug AIS 2026 - one page.xlsx");
const previewPath = path.join(outputDir, "post-edit-aware-stuff.png");

await fs.mkdir(outputDir, { recursive: true });

// Import with artifact-tool to validate the workbook and target sheet before editing.
const beforeWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const beforeSheets = await beforeWorkbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 5000,
});
console.log("BEFORE_SHEETS");
console.log(beforeSheets.ndjson);

// Page setup is stored as worksheet OOXML metadata. Keep every other workbook part byte-for-byte.
const sourceBytes = await fs.readFile(inputPath);
const zip = await JSZip.loadAsync(sourceBytes);
const sheetPath = "xl/worksheets/sheet1.xml";
const sheetFile = zip.file(sheetPath);
if (!sheetFile) throw new Error(`Missing ${sheetPath}`);

let sheetXml = await sheetFile.async("string");
if (!sheetXml.includes("<pageSetup")) {
  throw new Error("Target sheet has no pageSetup element to update safely.");
}

if (/<sheetPr(?:\s[^>]*)?>/.test(sheetXml)) {
  if (/<pageSetUpPr\b/.test(sheetXml)) {
    sheetXml = sheetXml.replace(/<pageSetUpPr\b([^>]*)\/>/, (match, attrs) => {
      const clean = attrs
        .replace(/\sfitToPage="[^"]*"/g, "")
        .replace(/\sautoPageBreaks="[^"]*"/g, "");
      return `<pageSetUpPr${clean} fitToPage="1" autoPageBreaks="0"/>`;
    });
  } else {
    sheetXml = sheetXml.replace(/(<sheetPr(?:\s[^>]*)?>)/, "$1<pageSetUpPr fitToPage=\"1\" autoPageBreaks=\"0\"/>");
  }
} else {
  sheetXml = sheetXml.replace(/(<dimension\b)/, '<sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr>$1');
}

sheetXml = sheetXml.replace(/<pageSetup\b([^>]*)\/>/, (match, attrs) => {
  const clean = attrs
    .replace(/\sscale="[^"]*"/g, "")
    .replace(/\sfitToWidth="[^"]*"/g, "")
    .replace(/\sfitToHeight="[^"]*"/g, "");
  return `<pageSetup${clean} fitToWidth="1" fitToHeight="1"/>`;
});

zip.file(sheetPath, sheetXml);
const outputBytes = await zip.generateAsync({
  type: "uint8array",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
await fs.writeFile(outputPath, outputBytes);

// Re-open the finished workbook with artifact-tool and perform compact checks.
const afterWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const targetCheck = await afterWorkbook.inspect({
  kind: "table",
  range: "'Aware stuff'!A1:L53",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 12,
  maxChars: 5000,
});
console.log("TARGET_CHECK");
console.log(targetCheck.ndjson);

const formulaErrors = await afterWorkbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 5000,
});
console.log("FORMULA_ERRORS");
console.log(formulaErrors.ndjson);

const preview = await afterWorkbook.render({
  sheetName: "Aware stuff",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const finalZip = await JSZip.loadAsync(await fs.readFile(outputPath));
const finalXml = await finalZip.file(sheetPath).async("string");
const pageSetup = finalXml.match(/<pageSetup\b[^>]*\/>/)?.[0] ?? "missing";
const pageSetupProperties = finalXml.match(/<pageSetUpPr\b[^>]*\/>/)?.[0] ?? "missing";
console.log("FINAL_PAGE_SETUP");
console.log(pageSetupProperties);
console.log(pageSetup);
console.log(`OUTPUT ${path.resolve(outputPath)}`);
