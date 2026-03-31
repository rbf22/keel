import { describe, it, expect } from 'vitest';
import { SecureWebFetcher } from './secure-web-fetcher';

describe('SecureWebFetcher - extractContent', () => {
  it('should return null for allorigins format when result is string', () => {
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent('string content', 'allorigins');
    expect(result).toBeNull();
  });

  it('should return contents for allorigins format when result is object', () => {
    const mockResult = { contents: 'test content', status: 200 };
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent(mockResult, 'allorigins');
    expect(result).toBe('test content');
  });

  it('should return null for allorigins format when contents is missing', () => {
    const mockResult = { status: 200 };
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent(mockResult, 'allorigins');
    expect(result).toBeNull();
  });

  it('should return string directly for direct format', () => {
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent('direct content', 'direct');
    expect(result).toBe('direct content');
  });

  it('should return data field for direct format when result is object', () => {
    const mockResult = { data: 'test data', other: 'ignored' };
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent(mockResult, 'direct');
    expect(result).toBe('test data');
  });

  it('should return contents field for direct format when data is missing', () => {
    const mockResult = { contents: 'test contents', other: 'ignored' };
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent(mockResult, 'direct');
    expect(result).toBe('test contents');
  });

  it('should return null for direct format when neither data nor contents exist', () => {
    const mockResult = { other: 'ignored', status: 200 };
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent(mockResult, 'direct');
    expect(result).toBeNull();
  });

  it('should return null for unknown format', () => {
    const mockResult = { data: 'test' };
    // @ts-expect-error - Testing private method
    const result = SecureWebFetcher.extractContent(mockResult, 'unknown');
    expect(result).toBeNull();
  });
});
