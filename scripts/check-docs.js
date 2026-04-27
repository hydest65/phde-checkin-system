const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const root = path.resolve(__dirname, "..");
const requiredDocs = [
  "docs/CHANGELOG.md",
  "docs/DOC_UPDATE_RULES.md",
  "docs/PRD.md",
  "docs/TECHNICAL_PLAN.md",
  "docs/WEB_TEST_DEPLOY.md",
];

const textExtensions = new Set([".html", ".js", ".css", ".json", ".md", ".bat"]);
const forbiddenPathPattern = /[\u4e00-\u9fff]/;
const forbiddenContentPatterns = [
  "PHDE\u7edb",
  "\u7edb\u60e7\u57cc",
  "\u938b\u20ac",
  "\u934b\u6a3a\u4f10",
  "\u93c4",
  "C:\\Users\\lixin11190\\Documents\\New project\\PHDE签到系统",
];

const decoder = new TextDecoder("utf-8", { fatal: true });
let hasError = false;

function fail(message) {
  hasError = true;
  console.error(`ERROR: ${message}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

for (const doc of requiredDocs) {
  if (!fs.existsSync(path.join(root, doc))) fail(`Missing required document: ${doc}`);
}

for (const filePath of walk(root)) {
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  if (forbiddenPathPattern.test(relativePath)) fail(`Chinese characters found in file path: ${relativePath}`);
  if (!textExtensions.has(path.extname(filePath).toLowerCase())) continue;

  let content = "";
  try {
    content = decoder.decode(fs.readFileSync(filePath));
  } catch (error) {
    fail(`File is not valid UTF-8: ${relativePath}`);
    continue;
  }

  for (const pattern of forbiddenContentPatterns) {
    if (content.includes(pattern)) fail(`Possible mojibake or old path found in ${relativePath}: ${pattern}`);
  }
}

if (hasError) process.exit(1);
console.log("Document checks passed.");
