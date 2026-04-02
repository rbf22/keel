import { test, expect } from '@playwright/test';

test.describe('Skills Loading Debug', () => {
  test('should load skills from filesystem and execute successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForSelector('#initBtn');
    
    // Initialize the system
    await page.click('#initBtn');
    
    // Wait for initialization to complete (check for "Keel Ready" status)
    await page.waitForFunction(() => {
      const statusEl = document.getElementById('status');
      return statusEl?.textContent?.includes('Keel Ready');
    }, { timeout: 30000 });
    
    // Check skills tab to see if skills are loaded
    await page.click('[data-tab="skills"]');
    await page.waitForTimeout(1000);
    
    // Get skills list content
    const skillsList = await page.locator('#skillsList').textContent();
    console.log('Skills list content:', skillsList);
    
    // Try a simple query
    await page.click('[data-tab="chat"]');
    await page.fill('#userInput', 'What is 2 + 2?');
    await page.click('#sendBtn');
    
    // Wait for response (should not get skill not found errors)
    try {
      await page.waitForTimeout(5000);
      
      // Check for error messages
      const messages = await page.locator('.message').allTextContents();
      const hasSkillErrors = messages.some(msg => 
        msg.includes('Skill') && msg.includes('not found')
      );
      
      if (hasSkillErrors) {
        console.error('❌ Skills not found errors detected:', messages);
        throw new Error('Skills are not being loaded properly');
      }
      
      console.log('✅ No skill errors detected');
      
    } catch (error) {
      // Capture console logs for debugging
      const logs = await page.evaluate(() => {
        return (window as any).capturedLogs || [];
      });
      console.error('Browser logs:', logs);
      throw error;
    }
  });
});
