import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load(process.argv[2]);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange(true).values;
const lastSourceIndex = used.reduce(
  (last, row, index) => (String(row?.[0] ?? "").trim() ? index : last),
  0,
);
const dataRows = used.slice(1, lastSourceIndex + 1);
const values = dataRows.map((row) => [row?.[2], row?.[3], row?.[4]]);
const matched = values.filter((row) => row[0] && row[1] && !row[2]);
const remarks = values.filter((row) => !row[0] && !row[1] && row[2]);
const malformed = values
  .map((row, i) => ({ row: i + 2, values: row }))
  .filter(({ values: row }) => !((row[0] && row[1] && !row[2]) || (!row[0] && !row[1] && row[2])));
const extraOutputs = used
  .map((row, index) => ({ row: index + 1, source: row?.[0], values: [row?.[2], row?.[3], row?.[4]] }))
  .filter(({ row, source, values: output }) => row > 1 && !String(source ?? "").trim() && output.some((value) => String(value ?? "").trim()));
const ambiguousRemarks = dataRows
  .map((row, index) => ({ row: index + 2, target: row?.[0], remark: String(row?.[4] ?? "") }))
  .filter(({ remark }) => remark.startsWith("Ambiguous:"));
const ambiguousWithoutLinks = ambiguousRemarks.filter(({ remark }) => !remark.includes("https://ganknow.com/post/"));
const findTarget = (target) => {
  const index = dataRows.findIndex((row) => String(row?.[0] ?? "").trim().toLowerCase() === target.toLowerCase());
  return index < 0 ? null : { row: index + 2, target: dataRows[index][0], values: values[index] };
};
console.log(JSON.stringify({
  sourceRowCount: dataRows.length,
  matched: matched.length,
  remarks: remarks.length,
  malformed,
  extraOutputs,
  ambiguousRemarks: ambiguousRemarks.length,
  ambiguousWithoutLinks,
  checks: {
    dayoung: findTarget("260620 dayoung 1734"),
    chaewon: findTarget("260827 chaewon section A yoichi"),
    chaewonBackview: findTarget("260711 CHAEWON BACKVIEW COLLECTION"),
    yubinSecondSet: findTarget("260613 YUBIN (2)"),
    iroha: findTarget("260827 iroha"),
    rei912: findTarget("260821 rei 912"),
    jeewon2484: findTarget("260828 jeewon 2484"),
    eunchae2075: findTarget("260827 eunchae 2075"),
    lastSource: { row: lastSourceIndex + 1, values: used[lastSourceIndex] },
  },
}, null, 2));
