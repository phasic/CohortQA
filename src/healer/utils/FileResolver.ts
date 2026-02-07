/**
 * Utility for resolving test file paths from directories or partial paths
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFailure } from '../types.js';

export class FileResolver {
  /**
   * Resolves a test file path, handling directories and partial paths
   */
  static async resolveTestFile(failure: TestFailure): Promise<string[]> {
    let testFilePath = failure.file;
    const filesToTry: string[] = [];

    if (!testFilePath || testFilePath.endsWith('.spec.ts')) {
      if (testFilePath) {
        filesToTry.push(testFilePath);
      }
      return filesToTry;
    }

    // If it's a directory, try to find the test file
    try {
      const entries = await fs.readdir(testFilePath, { withFileTypes: true });
      const specFiles = entries
        .filter(e => e.isFile() && e.name.endsWith('.spec.ts'))
        .map(e => path.join(testFilePath, e.name));

      if (specFiles.length === 1) {
        filesToTry.push(specFiles[0]);
        return filesToTry;
      }

      if (specFiles.length > 1) {
        // Try to match by test name or error location
        const matchedFile = await this.findMatchingFile(specFiles, failure);
        if (matchedFile) {
          filesToTry.push(matchedFile);
          return filesToTry;
        }

        // Fallback: find files with problematic patterns
        const errorLower = failure.error.toLowerCase();
        for (const specFile of specFiles) {
          try {
            const fileContent = await fs.readFile(specFile, 'utf-8');
            // If it's a strict mode violation, check if file has the pattern
            if (errorLower.includes('strict mode violation') && fileContent.includes("getByRole('link', { name: 'link' })")) {
              filesToTry.push(specFile);
            }
            // If it's a toHaveTitle error, check if file has toHaveTitle
            else if (errorLower.includes('tohavetitle') && fileContent.includes('toHaveTitle')) {
              filesToTry.push(specFile);
            }
          } catch {
            // Skip files we can't read
          }
        }

        // If still no matches, try all files (aggressive fix)
        if (filesToTry.length === 0) {
          filesToTry.push(...specFiles);
        }
      }
    } catch (err) {
      // Directory doesn't exist or can't be read
    }

    return filesToTry;
  }

  /**
   * Finds a matching test file based on test name or error location
   */
  private static async findMatchingFile(
    specFiles: string[],
    failure: TestFailure
  ): Promise<string | null> {
    // Extract line number from error if available
    const lineMatch = failure.error.match(/at\s+[^:]+:(\d+):\d+/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : null;

    for (const specFile of specFiles) {
      try {
        const fileContent = await fs.readFile(specFile, 'utf-8');
        
        // Check if test name matches
        if (failure.testName !== 'Unknown test') {
          if (fileContent.includes(`test('${failure.testName}'`) || 
              fileContent.includes(`test("${failure.testName}"`)) {
            return specFile;
          }
        }
        
        // Or check if error line matches
        if (errorLine) {
          const lines = fileContent.split('\n');
          if (errorLine <= lines.length) {
            // Check if this line has the problematic code
            const problemLine = lines[errorLine - 1];
            if (problemLine.includes('getByRole') && problemLine.includes("name: 'link'")) {
              return specFile;
            }
          }
        }
        
        // Check if file contains the problematic pattern
        if (fileContent.includes("getByRole('link', { name: 'link' })")) {
          return specFile;
        }
      } catch {
        // Skip files we can't read
      }
    }

    return null;
  }
}

