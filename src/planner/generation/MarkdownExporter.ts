import * as fs from 'fs/promises';
import * as path from 'path';
import { TestPlan } from '../types.js';

/**
 * Exports test plans to Markdown format
 */
export class MarkdownExporter {
  /**
   * Saves a test plan to a Markdown file
   */
  static async saveMarkdown(plan: TestPlan, outputPath: string): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    let markdown = `# ${plan.title}\n\n`;
    markdown += `${plan.overview}\n\n`;
    markdown += `## Test Scenarios\n\n`;

    plan.scenarios.forEach((scenario, index) => {
      markdown += `### ${index + 1}. ${scenario.title}\n\n`;
      
      if (scenario.seed) {
        markdown += `**Seed Test**: \`${scenario.seed}\`\n\n`;
      }

      markdown += `**Steps:**\n`;
      scenario.steps.forEach((step, stepIndex) => {
        markdown += `${stepIndex + 1}. ${step}\n`;
      });
      markdown += `\n`;

      markdown += `**Expected Results:**\n`;
      scenario.expectedResults.forEach((result, resultIndex) => {
        markdown += `- ${result}\n`;
      });
      markdown += `\n`;
    });

    await fs.writeFile(outputPath, markdown, 'utf-8');
  }
}

