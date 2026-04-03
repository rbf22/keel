// Fix model selection by clearing invalid model and setting to available one
console.log('Fixing model selection...');

// Clear the invalid model selection
localStorage.removeItem('selectedModelId');
console.log('Cleared invalid selectedModelId');

// Set to a known good model (SmolLM2-360M is the smallest and should work)
const goodModel = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
localStorage.setItem('selectedModelId', goodModel);
console.log(`Set selectedModelId to: ${goodModel}`);

// Verify the fix
const currentSelection = localStorage.getItem('selectedModelId');
console.log(`Current selectedModelId: ${currentSelection}`);

console.log('Model selection fix complete! Please refresh the page.');
