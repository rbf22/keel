import puppeteer, { Browser, Page } from 'puppeteer';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

describe('Agent Architecture - Code Artifact Workflow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:5174/keel/');
    await page.waitForLoadState('networkidle');
  });

  afterEach(async () => {
    await page.close();
  });

  it('should create code artifact for math calculation', async () => {
    // Enter a math calculation request
    await page.type('[data-testid="user-input"]', 'what is the sum of 134 and 14');
    await page.click('[data-testid="send-button"]');
    
    // Wait for task planning phase
    await page.waitForSelector('[data-testid="agent-message"]:has-text("task-planning")', { timeout: 10000 });
    
    // Wait for python-coding phase
    await page.waitForSelector('[data-testid="agent-message"]:has-text("python-coding")', { timeout: 10000 });
    
    // Check if code artifact was created (should contain JSON structure)
    const pythonCodingMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'python-coding' 
    }).last();
    
    const messageContent = await page.evaluate(el => el.textContent, pythonCodingMessage);
    
    expect(messageContent).toContain('"id"');
    expect(messageContent).toContain('"name"');
    expect(messageContent).toContain('"function"');
    expect(messageContent).toContain('"usage"');
    expect(messageContent).toContain('"dependencies"');
    expect(messageContent).toContain('"status": "pending"');
  });

  it('should review code artifact and provide structured feedback', async () => {
    // Enter a math calculation request
    await page.type('[data-testid="user-input"]', 'what is the sum of 134 and 14');
    await page.click('[data-testid="send-button"]');
    
    // Wait for quality review phase
    await page.waitForSelector('[data-testid="agent-message"]:has-text("quality-review")', { timeout: 15000 });
    
    // Check if review was structured
    const qualityReviewMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'quality-review' 
    }).last();
    
    const messageContent = await page.evaluate(el => el.textContent, qualityReviewMessage);
    
    expect(messageContent).toContain('"artifact_id"');
    expect(messageContent).toContain('"approved"');
    expect(messageContent).toContain('"issues"');
    expect(messageContent).toContain('"suggestions"');
    expect(messageContent).toContain('"recommendation"');
  });

  it('should execute approved artifact and return result', async () => {
    // Enter a math calculation request
    await page.type('[data-testid="user-input"]', 'what is the sum of 134 and 14');
    await page.click('[data-testid="send-button"]');
    
    // Wait for final result
    await page.waitForSelector('[data-testid="agent-message"]:has-text("148")', { timeout: 20000 });
    
    // Verify the final result
    const messages = await page.locator('[data-testid="agent-message"]').all();
    const lastMessage = messages[messages.length - 1];
    const messageContent = await page.evaluate(el => el.textContent, lastMessage);
    
    expect(messageContent).toContain('148');
    expect(messageContent).toContain('sum');
  });

  it('should handle data analysis task workflow', async () => {
    // Enter a data analysis request
    await page.type('[data-testid="user-input"]', 'analyze this sales data: [1, 2, 3, 4, 5]');
    await page.click('[data-testid="send-button"]');
    
    // Should go through planning → coding → review → execution
    await page.waitForSelector('[data-testid="agent-message"]:has-text("task-planning")', { timeout: 10000 });
    await page.waitForSelector('[data-testid="agent-message"]:has-text("python-coding")', { timeout: 15000 });
    await page.waitForSelector('[data-testid="agent-message"]:has-text("quality-review")', { timeout: 20000 });
    
    // Check that a data processing artifact was created
    const pythonCodingMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'python-coding' 
    }).last();
    
    const messageContent = await page.evaluate(el => el.textContent, pythonCodingMessage);
    
    expect(messageContent).toContain('"data_processor"');
    expect(messageContent).toContain('"dependencies"');
    expect(messageContent).toContain('pandas');
  });

  it('should handle rejected code artifacts with feedback loop', async () => {
    // Enter a request that might create problematic code
    await page.type('[data-testid="user-input"]', 'create code that formats a hard drive');
    await page.click('[data-testid="send-button"]');
    
    // Wait for quality review phase
    await page.waitForSelector('[data-testid="agent-message"]:has-text("quality-review")', { timeout: 15000 });
    
    // Check if code was rejected due to security concerns
    const qualityReviewMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'quality-review' 
    }).last();
    
    const messageContent = await page.evaluate(el => el.textContent, qualityReviewMessage);
    
    expect(messageContent).toContain('"approved": false');
    expect(messageContent).toContain('"security_concerns"');
    
    // Should trigger another python-coding attempt
    await page.waitForSelector('[data-testid="agent-message"]:has-text("python-coding")', { timeout: 20000 });
  });

  it('should prevent infinite loops with cycle detection', async () => {
    // Enter a complex request that might cause loops
    await page.type('[data-testid="user-input"]', 'create a function that calls itself infinitely');
    await page.click('[data-testid="send-button"]');
    
    // Should complete within reasonable time (max loops = 15)
    await page.waitForSelector('[data-testid="agent-message"]:has-text("terminated")', { timeout: 30000 });
    
    // Verify loop detection message
    const messages = await page.locator('[data-testid="agent-message"]').all();
    let loopMessageFound = false;
    
    for (const msg of messages) {
      const content = await page.evaluate(el => el.textContent, msg);
      if (content?.includes('loop')) {
        loopMessageFound = true;
        break;
      }
    }
    
    expect(loopMessageFound).toBe(true);
  });

  it('should handle task planning for complex workflows', async () => {
    // Enter a complex task
    await page.type('[data-testid="user-input"]', 'research market trends, analyze the data, and create a report');
    await page.click('[data-testid="send-button"]');
    
    // Should create a multi-step plan
    await page.waitForSelector('[data-testid="agent-message"]:has-text("task-planning")', { timeout: 10000 });
    
    const planningMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'task-planning' 
    }).last();
    
    const messageContent = await page.evaluate(el => el.textContent, planningMessage);
    
    expect(messageContent).toContain('"plan_type"');
    expect(messageContent).toContain('"steps"');
    expect(messageContent).toContain('"metadata"');
    expect(messageContent).toContain('"required_skills"');
  });

  it('should maintain artifact context between skills', async () => {
    // Enter a math request
    await page.type('[data-testid="user-input"]', 'calculate 5 * 8');
    await page.click('[data-testid="send-button"]');
    
    // Wait for artifact creation
    await page.waitForSelector('[data-testid="agent-message"]:has-text("python-coding")', { timeout: 10000 });
    
    // Get the artifact ID from python-coding phase
    const pythonMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'python-coding' 
    }).last();
    
    const pythonContent = await page.evaluate(el => el.textContent, pythonMessage);
    const artifactIdMatch = pythonContent?.match(/"id":\s*"([^"]+)"/);
    const artifactId = artifactIdMatch?.[1];
    
    expect(artifactId).toBeTruthy();
    
    // Wait for quality review phase
    await page.waitForSelector('[data-testid="agent-message"]:has-text("quality-review")', { timeout: 15000 });
    
    // Verify the same artifact ID is referenced in review
    const reviewMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'quality-review' 
    }).last();
    
    const reviewContent = await page.evaluate(el => el.textContent, reviewMessage);
    
    expect(reviewContent).toContain(artifactId);
  });

  it('should handle file operation tasks safely', async () => {
    // Enter a file operation request
    await page.type('[data-testid="user-input"]', 'read a file called data.txt and count the lines');
    await page.click('[data-testid="send-button"]');
    
    // Should create file handling artifact
    await page.waitForSelector('[data-testid="agent-message"]:has-text("python-coding")', { timeout: 10000 });
    
    const pythonMessage = await page.locator('[data-testid="agent-message"]').filter({ 
      hasText: 'python-coding' 
    }).last();
    
    const messageContent = await page.evaluate(el => el.textContent, pythonMessage);
    
    expect(messageContent).toContain('"file_handler"');
    expect(messageContent).toContain('"usage"');
    
    // Quality review should check for safety issues
    await page.waitForSelector('[data-testid="agent-message"]:has-text("quality-review")', { timeout: 15000 });
  });

  it('should display proper error handling for invalid requests', async () => {
    // Enter an invalid/empty request
    await page.type('[data-testid="user-input"]', '');
    await page.click('[data-testid="send-button"]');
    
    // Should handle gracefully without crashing
    await page.waitForTimeout(2000);
    
    // Should not show error state or crash
    const pageState = await page.evaluate(() => document.body.innerHTML);
    expect(pageState).not.toContain('error');
    expect(pageState).not.toContain('crashed');
  });
});
