import puppeteer, { Browser, Page } from 'puppeteer';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Declare window globals for TypeScript
declare global {
  interface Window {
    keelSystem: {
      ready: boolean;
      submitTask: (task: string) => Promise<void>;
      setUpdateCallback: (callback: (response: any) => void) => void;
    };
    testAgentResponses: any[];
  }
}

describe('Skill-Based System Integration Tests', () => {
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
    
    // Set up console logging to capture agent responses
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Navigate to the test page
    await page.goto('http://localhost:5173/keel/test-agent-system.html');
    
    // Wait for the service worker to be ready
    await page.waitForFunction(() => {
      return window.keelSystem && window.keelSystem.ready;
    }, { timeout: 30000 });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should execute calculation task using python-coding skill', async () => {
    // Set up task listener to capture skill responses
    const agentResponses: any[] = [];
    await page.evaluate(() => {
      window.keelSystem.setUpdateCallback((response: any) => {
        window.testAgentResponses = window.testAgentResponses || [];
        window.testAgentResponses.push(response);
      });
    });

    // Submit a calculation task
    await page.evaluate(() => {
      return window.keelSystem.submitTask('Calculate 2x3');
    });

    // Wait for task completion or timeout
    await page.waitForFunction(() => {
      const responses = window.testAgentResponses || [];
      return responses.some(r => r.personaId === 'system' && r.type === 'error') ||
             responses.some(r => r.content?.includes('Task completed successfully')) ||
             responses.some(r => r.content?.includes('FINISH')) ||
             responses.length > 20; // Prevent infinite wait
    }, { timeout: 30000 });

    // Get the responses
    const responses = await page.evaluate(() => window.testAgentResponses || []);
    
    console.log('Skill-based responses:', responses);

    // Analyze the skill execution pattern
    const systemResponses = responses.filter(r => r.personaId === 'system');
    const skillExecutionEvents = systemResponses.filter(r => 
      r.content && r.content.includes('Executing skill')
    );
    
    console.log('System responses:', systemResponses.length);
    console.log('Skill execution events found:', skillExecutionEvents.length);

    // Check if python-coding skill was executed
    expect(skillExecutionEvents.length).toBeGreaterThan(0);
    
    // Verify skill execution format
    const skillExecution = skillExecutionEvents[0];
    expect(skillExecution.content).toContain('Executing skill');
    expect(skillExecution.personaId).toBe('system');
  });

  it('should complete full calculation workflow within reasonable time', async () => {
    const startTime = Date.now();
    const agentResponses: any[] = [];
    
    await page.evaluate(() => {
      window.keelSystem.setUpdateCallback((response: any) => {
        window.testAgentResponses = window.testAgentResponses || [];
        window.testAgentResponses.push(response);
      });
    });

    // Submit calculation task
    await page.evaluate(() => {
      return window.keelSystem.submitTask('Calculate 2x3 and return the result');
    });

    // Wait for task completion
    await page.waitForFunction(() => {
      const responses = window.testAgentResponses || [];
      return responses.some(r => r.content?.includes('Task completed successfully')) ||
             responses.some(r => r.content?.includes('FINISH')) ||
             responses.some(r => r.personaId === 'system' && r.type === 'error') ||
             responses.length > 25;
    }, { timeout: 30000 });

    const responses = await page.evaluate(() => window.testAgentResponses || []);
    const duration = Date.now() - startTime;
    
    console.log(`Task completed in ${duration}ms`);
    console.log('Total responses:', responses.length);

    // Should complete within reasonable time (30 seconds)
    expect(duration).toBeLessThan(30000);
    
    // Should have skill execution events
    const skillEvents = responses.filter(r => 
      r.personaId === 'system' && r.content?.includes('Executing skill')
    );
    expect(skillEvents.length).toBeGreaterThan(0);
    
    // Should have observer analysis events
    const observerEvents = responses.filter(r => r.personaId === 'observer');
    expect(observerEvents.length).toBeGreaterThan(0);
  });

  it('should detect and prevent infinite loops', async () => {
    const agentResponses: any[] = [];
    
    await page.evaluate(() => {
      window.keelSystem.setUpdateCallback((response: any) => {
        window.testAgentResponses = window.testAgentResponses || [];
        window.testAgentResponses.push(response);
      });
    });

    // Submit a task that could cause loops
    await page.evaluate(() => {
      return window.keelSystem.submitTask('Keep calculating 2x3 until I say stop');
    });

    // Wait for task completion or cycle detection
    await page.waitForFunction(() => {
      const responses = window.testAgentResponses || [];
      return responses.some(r => r.content?.includes('Detected repeating skill pattern')) ||
             responses.some(r => r.content?.includes('maximum loop limit')) ||
             responses.some(r => r.content?.includes('Task completed successfully')) ||
             responses.some(r => r.personaId === 'system' && r.type === 'error') ||
             responses.length > 30;
    }, { timeout: 45000 });

    const responses = await page.evaluate(() => window.testAgentResponses || []);
    
    console.log('Loop prevention test responses:', responses.length);

    // Should either complete successfully or detect cycles
    const cycleDetected = responses.some(r => r.content?.includes('Detected repeating skill pattern'));
    const maxLoopReached = responses.some(r => r.content?.includes('maximum loop limit'));
    const completed = responses.some(r => r.content?.includes('Task completed successfully'));
    
    expect(cycleDetected || maxLoopReached || completed).toBe(true);
    
    // Should not run indefinitely (cap at reasonable number of responses)
    expect(responses.length).toBeLessThan(50);
  });

  it('should properly handle different skill types', async () => {
    const agentResponses: any[] = [];
    
    await page.evaluate(() => {
      window.keelSystem.setUpdateCallback((response: any) => {
        window.testAgentResponses = window.testAgentResponses || [];
        window.testAgentResponses.push(response);
      });
    });

    // Submit a research task
    await page.evaluate(() => {
      return window.keelSystem.submitTask('Research information about Python programming');
    });

    // Wait for task completion
    await page.waitForFunction(() => {
      const responses = window.testAgentResponses || [];
      return responses.some(r => r.content?.includes('Task completed successfully')) ||
             responses.some(r => r.content?.includes('FINISH')) ||
             responses.some(r => r.personaId === 'system' && r.type === 'error') ||
             responses.length > 20;
    }, { timeout: 30000 });

    const responses = await page.evaluate(() => window.testAgentResponses || []);
    
    console.log('Research task responses:', responses.length);

    // Should have research skill execution
    const researchEvents = responses.filter(r => 
      r.personaId === 'system' && r.content?.includes('Executing skill: research')
    );
    expect(researchEvents.length).toBeGreaterThan(0);
    
    // Should have observer analysis
    const observerEvents = responses.filter(r => r.personaId === 'observer');
    expect(observerEvents.length).toBeGreaterThan(0);
  });
});
