import { TestPlan, TestScenario, PageInfo } from '../types.js';

/**
 * Generates test plans from analyzed pages
 */
export class TestPlanGenerator {
  /**
   * Generates overview text from all analyzed pages
   */
  static generateOverview(allPageInfo: PageInfo[]): string {
    if (allPageInfo.length === 0) {
      return 'No pages were explored.';
    }

    const firstPage = allPageInfo[0];
    let overview = `The ${firstPage.title} application provides the following functionality:\n\n`;
    
    overview += `**Explored Pages:** ${allPageInfo.length} page(s) were analyzed during exploration.\n\n`;

    // Aggregate statistics from all pages
    const totalForms = allPageInfo.reduce((sum, page) => sum + page.forms.length, 0);
    const totalButtons = allPageInfo.reduce((sum, page) => sum + page.buttons.length, 0);
    const totalInputs = allPageInfo.reduce((sum, page) => sum + page.inputs.length, 0);
    const totalLinks = allPageInfo.reduce((sum, page) => sum + page.links.length, 0);

    if (totalForms > 0) {
      overview += `- **Form Management**: ${totalForms} form(s) with input fields for data entry across ${allPageInfo.length} page(s)\n`;
    }
    
    if (totalButtons > 0) {
      overview += `- **Interactive Elements**: ${totalButtons} button(s) for user interactions\n`;
    }
    
    if (totalLinks > 0) {
      overview += `- **Navigation**: ${totalLinks} link(s) for page navigation\n`;
    }
    
    if (totalInputs > 0) {
      overview += `- **Input Fields**: ${totalInputs} input field(s) for user data entry\n`;
    }

    // List explored pages
    if (allPageInfo.length > 1) {
      overview += `\n**Pages Explored:**\n`;
      allPageInfo.forEach((page, index) => {
        overview += `${index + 1}. ${page.title} (${page.url})\n`;
      });
    }

    return overview;
  }

  /**
   * Generates test scenarios from all analyzed pages
   */
  static generateScenarios(allPageInfo: PageInfo[], initialUrl: string, seedTestPath?: string): TestScenario[] {
    // Normalize seed path to use tests/seed/ folder if it's a relative path
    let normalizedSeedPath = seedTestPath;
    if (seedTestPath && !seedTestPath.startsWith('/') && !seedTestPath.startsWith('tests/seed/')) {
      const seedFileName = seedTestPath.split('/').pop() || seedTestPath.split('\\').pop() || 'seed.spec.ts';
      normalizedSeedPath = `tests/seed/${seedFileName}`;
    }
    const scenarios: TestScenario[] = [];

    // Generate scenarios for each explored page
    allPageInfo.forEach((pageInfo, pageIndex) => {
      const pageTitle = pageInfo.title || `Page ${pageIndex + 1}`;
      const pageUrl = pageInfo.url || initialUrl;

      // Form interaction scenarios
      if (pageInfo.forms.length > 0 && pageInfo.inputs.length > 0) {
        const formInputs = pageInfo.inputs.filter((inp: any) => 
          inp.type !== 'submit' && inp.type !== 'button' && inp.type !== 'hidden'
        );
        
        if (formInputs.length > 0) {
                  scenarios.push({
                    title: `Submit Form on ${pageTitle}`,
                    seed: normalizedSeedPath,
            steps: [
              `Navigate to ${pageUrl}`,
              formInputs[0].placeholder 
                ? `Click in the "${formInputs[0].placeholder}" input field`
                : `Click in the input field`,
              `Type test data`,
              `Press Enter key or click submit button`
            ],
            expectedResults: [
              'Form submits successfully',
              'Page shows confirmation or redirects',
              'No validation errors appear'
            ]
          });
        }
      }

      // Button interaction scenarios
      if (pageInfo.buttons.length > 0) {
        const primaryButton = pageInfo.buttons[0];
        scenarios.push({
          title: `Click Button on ${pageTitle}`,
          seed: normalizedSeedPath,
          steps: [
            `Navigate to ${pageUrl}`,
            `Click the "${primaryButton.text}" button`
          ],
          expectedResults: [
            `Button with text "${primaryButton.text}" is visible and clickable`,
            'Button click is registered',
            'UI updates or navigation occurs',
            'No errors are displayed'
          ]
        });
      }

      // Navigation scenarios (links to other pages)
      if (pageInfo.links.length > 0) {
        const navigationLinks = pageInfo.links
          .filter((link: any) => link.href && !link.href.includes('#'))
          .slice(0, 3);

        navigationLinks.forEach((link: any) => {
                  scenarios.push({
                    title: `Navigate from ${pageTitle} via "${link.text}"`,
                    seed: normalizedSeedPath,
            steps: [
              `Navigate to ${pageUrl}`,
              `Click on the "${link.text}" link`
            ],
            expectedResults: [
              `Link with text "${link.text}" is visible and clickable`,
              'Page successfully navigates to the linked page',
              'URL changes to reflect navigation'
            ]
          });
        });
      }

      // Basic page load scenario
              scenarios.push({
                title: `Verify ${pageTitle} Loads Correctly`,
                seed: normalizedSeedPath,
        steps: [
          `Navigate to ${pageUrl}`
        ],
        expectedResults: [
          'Page loads without errors',
          `Page title is "${pageInfo.title}"`,
          'Key elements are visible'
        ]
      });
    });

    // Add cross-page navigation scenarios
    if (allPageInfo.length > 1) {
      for (let i = 0; i < allPageInfo.length - 1; i++) {
        const fromPage = allPageInfo[i];
        const toPage = allPageInfo[i + 1];
        
        // Find the link that navigates to the target page
        const navigationLink = fromPage.links.find((link: any) => {
          if (!link.href) return false;
          // Normalize URLs for comparison (remove trailing slashes, fragments, query params)
          const fromHref = link.href.split('#')[0].split('?')[0].replace(/\/$/, '');
          const toUrl = toPage.url.split('#')[0].split('?')[0].replace(/\/$/, '');
          return fromHref === toUrl || fromHref.includes(toUrl) || toUrl.includes(fromHref);
        });
        
        const linkText = navigationLink?.text || 'link';
        
                scenarios.push({
                  title: `Navigate from ${fromPage.title} to ${toPage.title}`,
                  seed: normalizedSeedPath,
          steps: [
            `Navigate to ${fromPage.url}`,
            `Click on the "${linkText}" link that navigates to ${toPage.title}`,
            `Wait for navigation to complete`
          ],
          expectedResults: [
            `Link with text "${linkText}" is visible and clickable`,
            'Navigation completes without errors',
            `Page title is "${toPage.title}"`,
            'URL changes to the target page',
            'Target page loads successfully'
          ]
        });
      }
    }

    return scenarios;
  }
}

