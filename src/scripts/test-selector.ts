import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

/**
 * Interactive test file selector
 * Lists all test files in the tests folder and allows selection
 */
async function main() {
  const testsDir = join(process.cwd(), 'tests');
  
  // Get all .spec.ts files in the tests directory
  let testFiles: string[] = [];
  
  try {
    const files = readdirSync(testsDir);
    testFiles = files
      .filter(file => {
        const filePath = join(testsDir, file);
        const stats = statSync(filePath);
        return stats.isFile() && (extname(file) === '.ts' || extname(file) === '.js' || file.endsWith('.spec.ts') || file.endsWith('.spec.js'));
      })
      .sort();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error('❌ Tests directory not found. Please run the generator first.');
      process.exit(1);
    }
    throw error;
  }
  
  if (testFiles.length === 0) {
    console.error('❌ No test files found in the tests directory.');
    process.exit(1);
  }
  
  // Show interactive selection (dynamic import for ES modules)
  const inquirer = await import('inquirer');
  const { selectedFile } = await inquirer.default.prompt([
    {
      type: 'list',
      name: 'selectedFile',
      message: 'Select a test file to run:',
      choices: testFiles,
      pageSize: 10,
    },
  ]);
  
  if (!selectedFile) {
    console.log('No file selected. Exiting.');
    process.exit(0);
  }
  
  const testFilePath = join(testsDir, selectedFile);
  console.log(`\n🚀 Running test: ${selectedFile}\n`);
  
  // Run the selected test file with Playwright
  try {
    execSync(`npx playwright test "${testFilePath}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error: any) {
    // Playwright test failures exit with non-zero code, which is expected
    // Only exit with error if it's not a test failure
    if (error.status !== undefined && error.status !== 0) {
      process.exit(error.status);
    }
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

