import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("xlsx path required");

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const result = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 30000,
  tableMaxRows: 500,
  tableMaxCols: 8,
  tableMaxCellChars: 300,
});
console.log(result.ndjson);
