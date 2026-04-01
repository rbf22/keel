#!/bin/bash

echo "=== Keel Engine Initialization Debug ==="
echo ""

echo "1. Checking if dev server is running..."
curl -s http://localhost:5173 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Dev server is running"
else
    echo "❌ Dev server is not running"
    echo "Please run: npm run dev"
    exit 1
fi

echo ""
echo "2. Testing WebLLM engine initialization..."
echo "Opening debug page..."

# Open the debug page
if command -v open > /dev/null; then
    open http://localhost:5173/debug-engine.html
elif command -v xdg-open > /dev/null; then
    xdg-open http://localhost:5173/debug-engine.html
else
    echo "Please open http://localhost:5173/debug-engine.html manually"
fi

echo ""
echo "3. Instructions:"
echo "   - Check the debug page for engine initialization progress"
echo "   - Monitor the browser console for detailed logs"
echo "   - If it hangs, the issue is likely with WebLLM engine"
echo ""
echo "4. Common solutions:"
echo "   - Refresh the page to clear service worker cache"
echo "   - Try a different browser (Chrome/Edge work best)"
echo "   - Check network connection for model download"
echo "   - Clear browser cache and storage"
echo ""
echo "5. If the issue persists:"
echo "   - The model might be too large for your GPU"
echo "   - Try using online mode instead"
echo "   - Check WebGPU support in your browser"
echo ""
echo "Debug logs will appear in the browser console."
