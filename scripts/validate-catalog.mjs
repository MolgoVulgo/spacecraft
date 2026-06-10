import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { formatValidationIssues, validateCatalogData } from '../src/catalog-validator.js';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-catalog.mjs <catalog.json>');
  process.exit(1);
}

const content = await readFile(filePath, 'utf8');
const catalog = JSON.parse(content);
const report = validateCatalogData(catalog);

if (report.errors.length) {
  console.error(formatValidationIssues(report.errors).join('\n'));
}
if (report.warnings.length) {
  console.warn(formatValidationIssues(report.warnings).join('\n'));
}

process.exit(report.valid ? 0 : 1);
