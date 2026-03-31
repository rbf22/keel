#!/usr/bin/env node

/**
 * Test runner for bug fix verification
 * Runs all tests related to the critical bug fixes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFiles = [
  'src/orchestrator.cycle-detection.test.ts',
  'src/logger.memory-limits.test.ts',
  'src/python-runtime.resource-cleanup.test.ts',
  'src/storage/skills.transaction-safety.test.ts',
  'src/skills/parser.yaml-edge-cases.test.ts',
  'src/utils/secure-web-fetcher.sanitization.test.ts'
];

console.log('🧪 Running Bug Fix Verification Tests\n');

// Check if test files exist
const missingFiles = testFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
  console.error('❌ Missing test files:');
  missingFiles.forEach(file => console.error(`   - ${file}`));
  process.exit(1);
}

// Run tests
const results = [];
for (const testFile of testFiles) {
  console.log(`\n📋 Running ${path.basename(testFile)}...`);
  
  try {
    const output = execSync(`npx vitest run ${testFile} --reporter=verbose`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Parse results
    const lines = output.split('\n');
    const testSummary = lines.find(line => line.includes('Test Files') || line.includes('PASS') || line.includes('FAIL'));
    
    results.push({
      file: testFile,
      status: 'PASS',
      output: output
    });
    
    console.log(`✅ ${path.basename(testFile)} - ${testSummary || 'All tests passed'}`);
  } catch (error) {
    results.push({
      file: testFile,
      status: 'FAIL',
      output: error.stdout || error.message
    });
    
    console.log(`❌ ${path.basename(testFile)} - Tests failed`);
    if (error.stdout) {
      console.log(error.stdout);
    }
  }
}

// Summary
console.log('\n📊 Test Summary');
console.log('================');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

console.log(`Total test suites: ${results.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed. Please review the output above.');
  console.log('\nNote: Some tests may have lint errors that need to be addressed.');
  process.exit(1);
} else {
  console.log('\n🎉 All bug fix tests passed successfully!');
  console.log('\nThe following fixes have been verified:');
  console.log('  • Agent cycle detection logic fixed');
  console.log('  • Logger memory limits implemented');
  console.log('  • Python runtime resource cleanup improved');
  console.log('  • Skill import transaction safety added');
  console.log('  • YAML parsing edge cases handled');
  console.log('  • HTML sanitization enhanced');
}
