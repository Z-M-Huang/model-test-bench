import { describe, it, expect } from 'vitest';
import { getAvailableToolNames, getEnabledTools } from './tools.js';

describe('tools', () => {
  describe('getAvailableToolNames', () => {
    it('returns all 3 built-in tool names', () => {
      const names = getAvailableToolNames();
      expect(names).toContain('read_file');
      expect(names).toContain('search_file');
      expect(names).toContain('web_search');
      expect(names).toHaveLength(3);
    });
  });

  describe('getEnabledTools', () => {
    it('returns empty object when no tools enabled', () => {
      const tools = getEnabledTools([]);
      expect(Object.keys(tools)).toHaveLength(0);
    });

    it('returns only requested tools', () => {
      const tools = getEnabledTools(['read_file']);
      expect(Object.keys(tools)).toEqual(['read_file']);
    });

    it('returns multiple tools', () => {
      const tools = getEnabledTools(['read_file', 'web_search']);
      expect(Object.keys(tools)).toEqual(['read_file', 'web_search']);
    });

    it('ignores unknown tool names', () => {
      const tools = getEnabledTools(['read_file', 'nonexistent']);
      expect(Object.keys(tools)).toEqual(['read_file']);
    });

    it('returns all tools when all names passed', () => {
      const tools = getEnabledTools(['read_file', 'search_file', 'web_search']);
      expect(Object.keys(tools)).toHaveLength(3);
    });
  });
});
