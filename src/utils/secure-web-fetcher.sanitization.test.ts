import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecureWebFetcher } from './secure-web-fetcher';
import { logger } from '../logger';

// Mock fetch
Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn()
});

// Store original DOMParser
const originalDOMParser = globalThis.DOMParser;

describe('SecureWebFetcher - HTML Sanitization', () => {
  beforeEach(() => {
    // Reset DOMParser to original before each test
    if (originalDOMParser) {
      Object.defineProperty(globalThis, 'DOMParser', {
        value: originalDOMParser,
        configurable: true
      });
    }
  });

  describe('sanitizeContent', () => {
    it('should remove script tags', () => {
      const content = '<div><script>alert("xss")</script><p>Safe content</p></div>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("xss")');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should remove iframe tags', () => {
      const content = '<div><iframe src="evil.com"></iframe><p>Safe content</p></div>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('evil.com');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should remove object and embed tags', () => {
      const content = '<div><object data="malicious.swf"></object><embed src="bad.swf"></embed></div>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('<embed');
    });

    it('should block javascript: URLs', () => {
      const content = '<a href="javascript:alert(\'xss\')">Click me</a>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('blocked:');
    });

    it('should remove event handlers', () => {
      const content = '<div onclick="alert(\'xss\')" onload="evil()" onmouseover="bad()">Content</div>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('onclick=');
      expect(sanitized).not.toContain('onload=');
      expect(sanitized).not.toContain('onmouseover=');
      // The event handlers are removed completely, not marked as blocked
    });

    it('should block data:text/html URLs', () => {
      const content = '<iframe src="data:text/html,<script>alert(\'xss\')</script>"></iframe>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('data:text/html');
      expect(sanitized).not.toContain('<iframe');
      // The iframe is completely removed, not just blocked
    });

    it('should preserve safe HTML content', () => {
      const content = `
        <div class="container">
          <h1>Title</h1>
          <p>This is <strong>safe</strong> content.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <a href="https://example.com">Safe link</a>
        </div>
      `;
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).toContain('<div class="container">');
      expect(sanitized).toContain('<h1>Title</h1>');
      expect(sanitized).toContain('<strong>safe</strong>');
      expect(sanitized).toContain('<a href="https://example.com">');
    });

    it('should handle complex nested structures', () => {
      const content = `
        <div>
          <script>function evil() { document.cookie = 'stolen=data'; }</script>
          <div onclick="evil()">
            <p>Click me</p>
            <iframe src="javascript:alert('xss')"></iframe>
          </div>
        </div>
      `;
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onclick=');
      // Event handlers are removed completely, not marked as blocked
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('<p>Click me</p>');
    });

    it('should use DOMParser when available for better sanitization', () => {
      // Mock DOMParser
      const mockRemoveAttribute = vi.fn();
      const mockElement = {
        hasAttributes: vi.fn().mockReturnValue(true),
        attributes: [{ name: 'onclick', value: "alert('xss')" }],
        removeAttribute: mockRemoveAttribute
      };
      
      const mockDOMParser = vi.fn().mockImplementation(() => ({
        parseFromString: vi.fn().mockReturnValue({
          querySelectorAll: vi.fn()
            .mockReturnValueOnce([]) // No scripts
            .mockReturnValueOnce([mockElement]) // Element with dangerous attribute
            .mockReturnValueOnce([]) // No styles
            .mockReturnValueOnce([]), // No scripts (second call)
          body: {
            innerHTML: '<div>Content</div>' // Return sanitized HTML
          }
        })
      }));
      
      const originalDOMParser = globalThis.DOMParser;
      Object.defineProperty(globalThis, 'DOMParser', { 
        value: mockDOMParser,
        configurable: true
      });
      
      const content = '<div onclick="alert(\'xss\')">Content</div>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(mockDOMParser).toHaveBeenCalledWith();
      expect(mockRemoveAttribute).toHaveBeenCalledWith('onclick');
      // The sanitized content should have the onclick attribute removed
      expect(sanitized).toBe('<div>Content</div>');
      
      // Restore original DOMParser
      Object.defineProperty(globalThis, 'DOMParser', { 
        value: originalDOMParser,
        configurable: true
      });
    });

    it('should fallback to regex when DOMParser fails', () => {
      vi.spyOn(logger, 'warn').mockImplementation(() => {});
      
      // Mock DOMParser to throw error
      Object.defineProperty(globalThis, 'DOMParser', { 
        value: vi.fn().mockImplementation(() => {
          throw new Error('DOMParser failed');
        })
      });
      
      const content = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(logger.warn).toHaveBeenCalledWith('secure-fetch', 'DOMParser sanitization failed, using regex fallback', expect.any(Object));
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should handle case variations in dangerous patterns', () => {
      const content = `
        <SCRIPT>alert("xss")</SCRIPT>
        <div ONCLICK="evil()">Content</div>
        <a HREF="JavaScript:alert('xss')">Link</a>
      `;
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('ONCLICK=');
      expect(sanitized).not.toContain('JavaScript:');
    });

    it('should preserve text content while removing dangerous elements', () => {
      const content = `
        <div>
          Before script
          <script type="text/javascript">
            // Malicious code
            alert('xss');
          </script>
          After script
        </div>
      `;
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).toContain('Before script');
      expect(sanitized).toContain('After script');
      expect(sanitized).not.toContain('alert(\'xss\')');
    });

    it('should handle malformed HTML gracefully', () => {
      const content = '<div><p>Unclosed paragraph<script>alert("xss")</script>';
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("xss")');
      // Should still contain the safe parts
      expect(sanitized).toContain('Unclosed paragraph');
    });

    it('should remove multiple instances of dangerous elements', () => {
      const content = `
        <script>alert(1)</script>
        <div>Content</div>
        <script>alert(2)</script>
        <iframe src="evil.com"></iframe>
        <script>alert(3)</script>
      `;
      const sanitized = SecureWebFetcher.sanitizeContent(content);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).toContain('<div>Content</div>');
    });
  });

  describe('Integration - Fetch with Sanitization', () => {
    it('should sanitize fetched content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<script>alert("xss")</script><p>Safe content</p>')
      });
      
      Object.defineProperty(globalThis, 'fetch', { value: mockFetch });
      
      const result = await SecureWebFetcher.fetch('https://example.com');
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe content</p>');
    });

    it('should handle sanitization errors gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<div>Content</div>')
      });
      
      Object.defineProperty(globalThis, 'fetch', { value: mockFetch });
      
      // Mock sanitizeContent to throw error
      const originalSanitize = SecureWebFetcher.sanitizeContent;
      SecureWebFetcher.sanitizeContent = vi.fn().mockImplementation(() => {
        throw new Error('Sanitization failed');
      });
      
      await expect(SecureWebFetcher.fetch('https://example.com')).rejects.toThrow('Sanitization failed');
      
      // Restore original method
      SecureWebFetcher.sanitizeContent = originalSanitize;
    });
  });
});
