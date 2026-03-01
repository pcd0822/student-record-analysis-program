#!/usr/bin/env node
/**
 * JSON 파일을 한 줄 문자열로 변환 (env 변수용)
 * 사용: node scripts/json-to-env.js <경로/키.json>
 * 또는: npm run json-to-env -- 경로/키.json
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('사용법: node scripts/json-to-env.js <경로/키.json>');
  console.error('예시: node scripts/json-to-env.js ./my-service-account.json');
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
if (!fs.existsSync(absPath)) {
  console.error('파일을 찾을 수 없습니다:', absPath);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
} catch (e) {
  console.error('JSON 파싱 실패:', e.message);
  process.exit(1);
}

const oneLine = JSON.stringify(data);
console.log(oneLine);
