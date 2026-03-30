import { execSync } from 'child_process';

try {
  console.log('Running tests...');
  const output = execSync('npx vitest run', { 
    encoding: 'utf8',
    stdio: 'inherit'
  });
  console.log(output);
} catch (error) {
  console.error('Test execution failed:', error.message);
  process.exit(1);
}
