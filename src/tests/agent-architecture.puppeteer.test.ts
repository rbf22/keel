import puppeteer, { Browser, Page } from 'puppeteer';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const expect = (value: any) => ({
  toContain: (expected: string) => {
    if (!value?.includes?.(expected)) {
      throw new Error(`Expected ${value} to contain ${expected}`);
    }
  },
  toBe: (expected: any) => {
    if (value !== expected) {
      throw new Error(`Expected ${value} to be ${expected}`);
    }
  },
  toBeTruthy: () => {
    if (!value) {
      throw new Error(`Expected ${value} to be truthy`);
    }
  },
  not: {
    toContain: (expected: string) => {
      if (value?.includes?.(expected)) {
        throw new Error(`Expected ${value} not to contain ${expected}`);
      }
    }
  }
});

describe('Agent Architecture - Code Artifact Workflow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:5174/keel/');
    await page.waitForNetworkIdle();
  });

  afterEach(async () => {
    await page.close();
  });

  it('should create code artifact for math calculation', async () => {
    // Enter a math calculation request
    await page.type('textarea, input[type="text"]', 'what is the sum of 134 and 14');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Wait for task planning phase
    await page.waitForFunction(
      () => document.body.innerText.includes('task-planning'),
      { timeout: 10000 }
    );
    
    // Wait for python-coding phase
    await page.waitForFunction(
      () => document.body.innerText.includes('python-coding'),
      { timeout: 10000 }
    );
    
    // Check if code artifact was created (should contain JSON structure)
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('"id"');
    expect(pageContent).toContain('"name"');
    expect(pageContent).toContain('"function"');
    expect(pageContent).toContain('"usage"');
    expect(pageContent).toContain('"dependencies"');
    expect(pageContent).toContain('"status": "pending"');
  });

  it('should review code artifact and provide structured feedback', async () => {
    // Enter a math calculation request
    await page.type('textarea, input[type="text"]', 'what is the sum of 134 and 14');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Wait for quality review phase
    await page.waitForFunction(
      () => document.body.innerText.includes('quality-review'),
      { timeout: 15000 }
    );
    
    // Check if review was structured
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('"artifact_id"');
    expect(pageContent).toContain('"approved"');
    expect(pageContent).toContain('"issues"');
    expect(pageContent).toContain('"suggestions"');
    expect(pageContent).toContain('"recommendation"');
  });

  it('should execute approved artifact and return result', async () => {
    // Enter a math calculation request
    await page.type('textarea, input[type="text"]', 'what is the sum of 134 and 14');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Wait for final result
    await page.waitForFunction(
      () => document.body.innerText.includes('148'),
      { timeout: 20000 }
    );
    
    // Verify the final result
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('148');
    expect(pageContent).toContain('sum');
  });

  it('should handle data analysis task workflow', async () => {
    // Enter a data analysis request
    await page.type('textarea, input[type="text"]', 'analyze this sales data: [1, 2, 3, 4, 5]');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Should go through planning → coding → review → execution
    await page.waitForFunction(
      () => document.body.innerText.includes('task-planning'),
      { timeout: 10000 }
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('python-coding'),
      { timeout: 15000 }
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('quality-review'),
      { timeout: 20000 }
    );
    
    // Check that a data processing artifact was created
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('"data_processor"');
    expect(pageContent).toContain('"dependencies"');
    expect(pageContent).toContain('pandas');
  });

  it('should handle rejected code artifacts with feedback loop', async () => {
    // Enter a request that might create problematic code
    await page.type('textarea, input[type="text"]', 'create code that formats a hard drive');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Wait for quality review phase
    await page.waitForFunction(
      () => document.body.innerText.includes('quality-review'),
      { timeout: 15000 }
    );
    
    // Check if code was rejected due to security concerns
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('"approved": false');
    expect(pageContent).toContain('"security_concerns"');
    
    // Should trigger another python-coding attempt
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        const pythonMatches = text.match(/python-coding/g);
        return pythonMatches && pythonMatches.length > 1;
      },
      { timeout: 20000 }
    );
  });

  it('should prevent infinite loops with cycle detection', async () => {
    // Enter a complex request that might cause loops
    await page.type('textarea, input[type="text"]', 'create a function that calls itself infinitely');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Should complete within reasonable time (max loops = 15)
    await page.waitForFunction(
      () => document.body.innerText.includes('terminated') || document.body.innerText.includes('loop'),
      { timeout: 30000 }
    );
    
    // Verify loop detection message
    const pageContent = await page.evaluate(() => document.body.innerText);
    const loopMessageFound = pageContent.includes('loop') || pageContent.includes('terminated');
    
    expect(loopMessageFound).toBe(true);
  });

  it('should handle task planning for complex workflows', async () => {
    // Enter a complex task
    await page.type('textarea, input[type="text"]', 'research market trends, analyze the data, and create a report');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Should create a multi-step plan
    await page.waitForFunction(
      () => document.body.innerText.includes('task-planning'),
      { timeout: 10000 }
    );
    
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('"plan_type"');
    expect(pageContent).toContain('"steps"');
    expect(pageContent).toContain('"metadata"');
    expect(pageContent).toContain('"required_skills"');
  });

  it('should maintain artifact context between skills', async () => {
    // Enter a math request
    await page.type('textarea, input[type="text"]', 'calculate 5 * 8');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Wait for artifact creation
    await page.waitForFunction(
      () => document.body.innerText.includes('python-coding'),
      { timeout: 10000 }
    );
    
    // Get the artifact ID from python-coding phase
    const pythonContent = await page.evaluate(() => {
      const text = document.body.innerText;
      const pythonMatch = text.match(/python-coding[^]*(?=quality-review|$)/);
      return pythonMatch ? pythonMatch[0] : '';
    });
    
    const artifactIdMatch = pythonContent?.match(/"id":\s*"([^"]+)"/);
    const artifactId = artifactIdMatch?.[1];
    
    expect(artifactId).toBeTruthy();
    
    // Wait for quality review phase
    await page.waitForFunction(
      () => document.body.innerText.includes('quality-review'),
      { timeout: 15000 }
    );
    
    // Verify the same artifact ID is referenced in review
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain(artifactId);
  });

  it('should handle file operation tasks safely', async () => {
    // Enter a file operation request
    await page.type('textarea, input[type="text"]', 'read a file called data.txt and count the lines');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Should create file handling artifact
    await page.waitForFunction(
      () => document.body.innerText.includes('python-coding'),
      { timeout: 10000 }
    );
    
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('"file_handler"');
    expect(pageContent).toContain('"usage"');
    
    // Quality review should check for safety issues
    await page.waitForFunction(
      () => document.body.innerText.includes('quality-review'),
      { timeout: 15000 }
    );
  });

  it('should display proper error handling for invalid requests', async () => {
    // Enter an invalid/empty request
    await page.type('textarea, input[type="text"]', '');
    await page.click('button[type="submit"], button:has-text("Send"), button:has-text("send")');
    
    // Should handle gracefully without crashing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Should not show error state or crash
    const pageState = await page.evaluate(() => document.body.innerHTML || '');
    expect(pageState).not.toContain('error');
    expect(pageState).not.toContain('crashed');
  });
});
