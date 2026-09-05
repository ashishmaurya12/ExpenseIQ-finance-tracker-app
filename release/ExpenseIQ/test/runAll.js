const { spawnSync } = require('child_process');
const path = require('path');

const testFiles = [
  'test/analytics.test.js',
  'test/cash_flow.test.js',
  'test/anomalies.test.js',
  'test/financial_health.test.js',
  'test/financial_reports.test.js',
  'test/notifications.test.js',
  'test/recurring.test.js',
  'test/reminders.test.js',
  'test/security_isolation.test.js',
  'test/ai_deterministic.test.js',
  'test/ai_endpoints.test.js',
  'test/context.test.js',
  'test/context_accuracy.test.js',
  'test/regression.test.js',
  'test/test_isolation_regression.test.js'
];

console.log(`Starting sequential execution of ${testFiles.length} test suites...\n`);

let passedCount = 0;
let failedCount = 0;

for (const file of testFiles) {
  console.log(`▶ Running ${file}...`);
  const res = spawnSync(process.execPath, ['--test', '--test-force-exit', file], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    timeout: 30000
  });

  if (res.status === 0) {
    passedCount++;
    console.log(`✔ ${file} PASSED\n`);
  } else {
    failedCount++;
    console.error(`✖ ${file} FAILED with exit code ${res.status}\n`);
  }
}

console.log(`========================================`);
console.log(`Test Execution Summary:`);
console.log(`Total Suites: ${testFiles.length}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);
console.log(`========================================`);

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
