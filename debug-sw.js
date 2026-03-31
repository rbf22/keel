import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting debug test...');
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    protocolTimeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Log all console messages
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  try {
    console.log('Navigating to http://localhost:5173/keel/ ...');
    await page.goto('http://localhost:5173/keel/', { waitUntil: 'networkidle2' });
    
    // Wait a bit for SW to register
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check SW status
    const swStatus = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'not supported';
      const regs = await navigator.serviceWorker.getRegistrations();
      return {
        count: regs.length,
        controller: !!navigator.serviceWorker.controller,
        registrations: regs.map(r => ({
          scriptURL: r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL,
          scope: r.scope,
          state: r.active ? 'active' : (r.installing ? 'installing' : 'waiting')
        }))
      };
    });
    
    console.log('SW Status:', JSON.stringify(swStatus, null, 2));
    
    // Click initialize button
    console.log('Clicking initialize button...');
    await page.click('#initBtn');
    
    // Wait and monitor
    for (let i = 0; i < 30; i++) {
      const status = await page.evaluate(() => document.getElementById('status')?.textContent);
      console.log(`Status: ${status}`);
      
      if (status?.includes('Ready')) {
        console.log('SUCCESS: Engine initialized successfully!');
        break;
      } else if (status?.includes('Error')) {
        console.log('FAILED: Initialization failed with error');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
})();
