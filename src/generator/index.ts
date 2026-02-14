import { TestPlanParser } from './TestPlanParser.js';
import { PlaywrightGenerator } from './PlaywrightGenerator.js';
import { loadConfig } from '../planner/config.js';

/**
 * Main entry point for the generator
 * Reads test-plan.md and generates a Playwright test suite
 */
async function main() {
  const args = process.argv.slice(2);
  const testPlanPath = args.find(arg => arg.startsWith('--test-plan='))?.split('=')[1];
  const outputPath = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  
  try {
    // Load config for cookie settings
    const config = loadConfig();
    
    console.log('📖 Reading test plan...');
    const parser = new TestPlanParser();
    const testPlan = parser.parseTestPlan(testPlanPath);
    
    console.log(`✅ Parsed test plan with ${testPlan.steps.length} steps`);
    console.log(`   Start URL: ${testPlan.startUrl}`);
    
    console.log('\n🔨 Generating Playwright test suite...');
    const generator = new PlaywrightGenerator(config);
    const fileName = generator.generateFileName(testPlan.startUrl);
    const outputFile = generator.generateTestSuite(testPlan, outputPath, fileName);
    
    console.log(`✅ Test suite generated successfully!`);
    console.log(`   Output: ${outputFile}`);
    console.log(`   Filename: ${fileName}`);
    
  } catch (error: any) {
    console.error('❌ Error generating test suite:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

