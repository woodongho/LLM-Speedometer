import { describe, it, expect } from 'vitest';
import { normalizeEndpoint } from '@/lib/endpoint';

describe('normalizeEndpoint', () => {
  it('appends /v1/chat/completions to a plain base URL', () => {
    expect(normalizeEndpoint('http://localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
  });

  it('trims trailing slashes', () => {
    expect(normalizeEndpoint('http://localhost:11434///')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
  });

  it('handles whitespace', () => {
    expect(normalizeEndpoint('  https://example.com  ')).toBe(
      'https://example.com/v1/chat/completions',
    );
  });

  it('keeps a /v1 base and appends chat/completions', () => {
    expect(normalizeEndpoint('http://localhost:8000/v1')).toBe(
      'http://localhost:8000/v1/chat/completions',
    );
  });

  it('returns a full /chat/completions URL unchanged', () => {
    const full = 'https://api.openai.com/v1/chat/completions';
    expect(normalizeEndpoint(full)).toBe(full);
  });

  it('returns empty input unchanged', () => {
    expect(normalizeEndpoint('   ')).toBe('');
  });

  it('does not double-append when the path already ends in /v1/chat/completions', () => {
    const full = 'http://localhost:8080/v1/chat/completions';
    expect(normalizeEndpoint(full)).toBe(full);
    expect(normalizeEndpoint(full).endsWith('/chat/completions')).toBe(true);
    expect(normalizeEndpoint(full).split('/chat/completions').length).toBe(2);
  });
});
