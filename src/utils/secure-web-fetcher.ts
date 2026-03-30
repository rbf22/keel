/**
 * Secure web fetcher with CORS proxy support and security measures.
 * Mitigates security risks from third-party CORS proxies.
 */

import { logger } from '../logger';

export interface FetchOptions {
  timeout?: number;
  maxSize?: number;
  allowedProtocols?: string[];
  sanitizeContent?: boolean;
}

export class SecureWebFetcher {
  private static readonly DEFAULT_OPTIONS: Required<FetchOptions> = {
    timeout: 10000,
    maxSize: 1024 * 1024, // 1MB limit
    allowedProtocols: ['http:', 'https:'],
    sanitizeContent: true
  };

  private static readonly PROXY_CONFIG = [
    { 
      url: 'https://api.allorigins.win/get?url=', 
      name: 'allorigins.win',
      responseFormat: 'allorigins' // { contents: string }
    },
    { 
      url: 'https://corsproxy.io/?', 
      name: 'corsproxy.io',
      responseFormat: 'direct' // Returns content directly
    },
    { 
      url: 'https://cors-anywhere.herokuapp.com/', 
      name: 'cors-anywhere',
      responseFormat: 'direct'
    }
  ];

  /**
   * Validate and sanitize a URL
   */
  private static validateUrl(url: string, allowedProtocols: string[]): URL {
    try {
      const parsedUrl = new URL(url);
      
      // Check protocol
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        throw new Error(`Protocol '${parsedUrl.protocol}' is not allowed. Only HTTP and HTTPS are supported.`);
      }
      
      // Block potentially dangerous URLs
      const blockedHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '[::1]',
        '[::]'
      ];
      
      const hostname = parsedUrl.hostname.toLowerCase();
      if (blockedHosts.includes(hostname)) {
        throw new Error(`Access to ${hostname} is not allowed for security reasons.`);
      }
      
      // Check for private IP ranges
      if (this.isPrivateIP(hostname)) {
        throw new Error('Access to private IP addresses is not allowed.');
      }
      
      return parsedUrl;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  /**
   * Check if hostname is a private IP address
   */
  private static isPrivateIP(hostname: string): boolean {
    // Check for common private IP patterns
    const privatePatterns = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^127\./,                    // 127.0.0.0/8
      /^169\.254\./,               // Link-local
      /^fc00:/i,                   // IPv6 private
      /^fe80:/i,                   // IPv6 link-local
    ];
    
    return privatePatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * Sanitize fetched content to remove potentially dangerous elements
   */
  private static sanitizeContent(content: string): string {
    // Remove script tags and event handlers
    let sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, 'blocked:')
      .replace(/on\w+\s*=/gi, 'data-blocked=')
      .replace(/data:text\/html/gi, 'blocked:');
    
    return sanitized;
  }

  /**
   * Extract content from proxy response based on format
   */
  private static extractContent(result: any, format: string): string | null {
    switch (format) {
      case 'allorigins':
        return result?.contents || null;
      case 'direct':
        // For direct responses, the result might be the content itself
        // or it might have a 'data' field
        if (typeof result === 'string') {
          return result;
        }
        return result?.data || result?.contents || JSON.stringify(result);
      default:
        return null;
    }
  }

  /**
   * Fetch content through CORS proxies with security measures
   */
  static async fetch(url: string, options: FetchOptions = {}): Promise<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    logger.info('secure-fetch', 'Starting secure fetch', { url });
    
    // Validate URL
    let validatedUrl: URL;
    try {
      validatedUrl = this.validateUrl(url, opts.allowedProtocols);
    } catch (error: any) {
      logger.error('secure-fetch', 'URL validation failed', { url, error: error.message });
      throw error;
    }
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      logger.warn('secure-fetch', 'Fetch timeout triggered', { url });
    }, opts.timeout);
    
    const proxyErrors: string[] = [];
    
    for (const proxy of this.PROXY_CONFIG) {
      logger.info('secure-fetch', `Attempting fetch via ${proxy.name}`);
      
      try {
        const proxyUrl = `${proxy.url}${encodeURIComponent(validatedUrl.toString())}`;
        
        const response = await fetch(proxyUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json, text/plain, text/html',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          proxyErrors.push(`${proxy.name}: ${errorMsg}`);
          logger.warn('secure-fetch', `Proxy ${proxy.name} returned error`, {
            status: response.status,
            statusText: response.statusText
          });
          continue;
        }
        
        // Parse response
        let result: any;
        const contentType = response.headers.get('content-type') || '';
        
        try {
          if (contentType.includes('application/json')) {
            result = await response.json();
          } else {
            result = await response.text();
          }
        } catch (parseError) {
          proxyErrors.push(`${proxy.name}: Parse error`);
          logger.warn('secure-fetch', `Failed to parse response from ${proxy.name}`);
          continue;
        }
        
        // Extract content based on proxy format
        let content = this.extractContent(result, proxy.responseFormat);
        
        if (content === null) {
          proxyErrors.push(`${proxy.name}: Unexpected format`);
          logger.warn('secure-fetch', `Unexpected response format from ${proxy.name}`, { result });
          continue;
        }
        
        // Check size limit
        if (content.length > opts.maxSize) {
          logger.warn('secure-fetch', `Content from ${proxy.name} exceeds size limit`, {
            size: content.length,
            maxSize: opts.maxSize
          });
          content = content.substring(0, opts.maxSize) + '\n[Content truncated due to size limit]';
        }
        
        // Sanitize if enabled
        if (opts.sanitizeContent) {
          content = this.sanitizeContent(content);
        }
        
        clearTimeout(timeoutId);
        logger.info('secure-fetch', `Successfully fetched via ${proxy.name}`, {
          size: content.length
        });
        
        return content;
        
      } catch (err: any) {
        if (err.name === 'AbortError') {
          proxyErrors.push(`${proxy.name}: Timeout`);
          logger.warn('secure-fetch', `Proxy ${proxy.name} timed out`);
        } else {
          proxyErrors.push(`${proxy.name}: ${err.message}`);
          logger.warn('secure-fetch', `Proxy ${proxy.name} failed`, {
            error: err.message,
            name: err.name
          });
        }
        continue;
      }
    }
    
    clearTimeout(timeoutId);
    
    // All proxies failed
    const errorDetails = proxyErrors.join('; ');
    logger.error('secure-fetch', 'All CORS proxies failed', {
      url,
      errors: proxyErrors
    });
    
    throw new Error(`Failed to fetch content through any proxy. Details: ${errorDetails}`);
  }
}
