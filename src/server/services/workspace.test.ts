import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkspaceBuilder } from './workspace.js';
import type { Scenario } from '../types/index.js';
import { makeProvider, makeScenario } from './storage-test-helpers.js';

// Track workspace paths for cleanup
const cleanupPaths: string[] = [];

afterEach(async () => {
  for (const p of cleanupPaths) {
    await fs.rm(p, { recursive: true, force: true }).catch(() => {});
  }
  cleanupPaths.length = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspaceBuilder', () => {
  const builder = new WorkspaceBuilder();

  it('creates a temp directory under os.tmpdir()', async () => {
    const scenario = makeScenario();
    const result = await builder.createWorkspace(scenario);
    cleanupPaths.push(result.workspacePath);

    expect(result.workspacePath).toContain(os.tmpdir());
    expect(result.workspacePath).toContain('ctb-run-');
    const stat = await fs.stat(result.workspacePath);
    expect(stat.isDirectory()).toBe(true);
  });

  describe('CLAUDE.md files', () => {
    it('writes project-role CLAUDE.md at workspace root', async () => {
      const scenario = makeScenario({
        claudeMdFiles: [{ role: 'project', content: '# Project Rules' }],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const content = await fs.readFile(
        path.join(result.workspacePath, 'CLAUDE.md'),
        'utf-8',
      );
      expect(content).toBe('# Project Rules');
    });

    it('writes user-role CLAUDE.md at .claude/CLAUDE.md', async () => {
      const scenario = makeScenario({
        claudeMdFiles: [{ role: 'user', content: '# User Prefs' }],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const content = await fs.readFile(
        path.join(result.workspacePath, '.claude', 'CLAUDE.md'),
        'utf-8',
      );
      expect(content).toBe('# User Prefs');
    });

    it('writes both project and user CLAUDE.md files', async () => {
      const scenario = makeScenario({
        claudeMdFiles: [
          { role: 'project', content: 'project-content' },
          { role: 'user', content: 'user-content' },
        ],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const projectContent = await fs.readFile(
        path.join(result.workspacePath, 'CLAUDE.md'),
        'utf-8',
      );
      const userContent = await fs.readFile(
        path.join(result.workspacePath, '.claude', 'CLAUDE.md'),
        'utf-8',
      );
      expect(projectContent).toBe('project-content');
      expect(userContent).toBe('user-content');
    });
  });

  describe('rules', () => {
    it('writes rules to .claude/rules/{name}.md', async () => {
      const scenario = makeScenario({
        rules: [
          { name: 'no-console', content: 'Do not use console.log' },
          { name: 'style', content: 'Use 2-space indent' },
        ],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const rule1 = await fs.readFile(
        path.join(result.workspacePath, '.claude', 'rules', 'no-console.md'),
        'utf-8',
      );
      const rule2 = await fs.readFile(
        path.join(result.workspacePath, '.claude', 'rules', 'style.md'),
        'utf-8',
      );
      expect(rule1).toBe('Do not use console.log');
      expect(rule2).toBe('Use 2-space indent');
    });

    it('rejects rule names with path separators', async () => {
      const scenario = makeScenario({
        rules: [{ name: '../evil', content: 'bad' }],
      });
      await expect(builder.createWorkspace(scenario)).rejects.toThrow(
        'must be a simple name',
      );
    });
  });

  describe('skills', () => {
    it('writes skills to .claude/skills/{name}/SKILL.md', async () => {
      const scenario = makeScenario({
        skills: [{ name: 'refactor', content: '# Refactoring skill' }],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const content = await fs.readFile(
        path.join(result.workspacePath, '.claude', 'skills', 'refactor', 'SKILL.md'),
        'utf-8',
      );
      expect(content).toBe('# Refactoring skill');
    });

    it('rejects skill names with path traversal', async () => {
      const scenario = makeScenario({
        skills: [{ name: '..', content: 'bad' }],
      });
      await expect(builder.createWorkspace(scenario)).rejects.toThrow(
        'must be a simple name',
      );
    });
  });

  describe('workspace files', () => {
    it('writes scenario workspace files at specified paths', async () => {
      const scenario = makeScenario({
        workspaceFiles: [
          { path: 'src/main.ts', content: 'console.log("hello")' },
          { path: 'README.md', content: '# Test' },
        ],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const main = await fs.readFile(
        path.join(result.workspacePath, 'src', 'main.ts'),
        'utf-8',
      );
      const readme = await fs.readFile(
        path.join(result.workspacePath, 'README.md'),
        'utf-8',
      );
      expect(main).toBe('console.log("hello")');
      expect(readme).toBe('# Test');
    });

    it('rejects absolute workspace file paths', async () => {
      const scenario = makeScenario({
        workspaceFiles: [{ path: '/etc/passwd', content: 'bad' }],
      });
      await expect(builder.createWorkspace(scenario)).rejects.toThrow(
        'must not be an absolute path',
      );
    });

    it('rejects workspace file paths with ..', async () => {
      const scenario = makeScenario({
        workspaceFiles: [{ path: '../escape/file.txt', content: 'bad' }],
      });
      await expect(builder.createWorkspace(scenario)).rejects.toThrow(
        "must not contain '..'",
      );
    });
  });

  describe('loadFromFile', () => {
    it('reads CLAUDE.md content from file when loadFromFile is set', async () => {
      const tmpFile = path.join(os.tmpdir(), `ctb-test-load-${Date.now()}.md`);
      await fs.writeFile(tmpFile, '# Loaded from file', 'utf-8');
      cleanupPaths.push(tmpFile);

      const scenario = makeScenario({
        claudeMdFiles: [{ role: 'project', content: 'ignored', loadFromFile: tmpFile }],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const content = await fs.readFile(
        path.join(result.workspacePath, 'CLAUDE.md'),
        'utf-8',
      );
      expect(content).toBe('# Loaded from file');
    });

    it('reads rule content from file when loadFromFile is set', async () => {
      const tmpFile = path.join(os.tmpdir(), `ctb-test-rule-${Date.now()}.md`);
      await fs.writeFile(tmpFile, 'Rule from file', 'utf-8');
      cleanupPaths.push(tmpFile);

      const scenario = makeScenario({
        rules: [{ name: 'loaded-rule', content: 'ignored', loadFromFile: tmpFile }],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const content = await fs.readFile(
        path.join(result.workspacePath, '.claude', 'rules', 'loaded-rule.md'),
        'utf-8',
      );
      expect(content).toBe('Rule from file');
    });

    it('reads skill content from file when loadFromFile is set', async () => {
      const tmpFile = path.join(os.tmpdir(), `ctb-test-skill-${Date.now()}.md`);
      await fs.writeFile(tmpFile, 'Skill from file', 'utf-8');
      cleanupPaths.push(tmpFile);

      const scenario = makeScenario({
        skills: [{ name: 'loaded-skill', content: 'ignored', loadFromFile: tmpFile }],
      });
      const result = await builder.createWorkspace(scenario);
      cleanupPaths.push(result.workspacePath);

      const content = await fs.readFile(
        path.join(
          result.workspacePath,
          '.claude',
          'skills',
          'loaded-skill',
          'SKILL.md',
        ),
        'utf-8',
      );
      expect(content).toBe('Skill from file');
    });
  });

  describe('cleanup', () => {
    it('removes the workspace directory', async () => {
      const result = await builder.createWorkspace(
        makeScenario({
          claudeMdFiles: [{ role: 'project', content: 'test' }],
          rules: [{ name: 'test-rule', content: 'rule' }],
          workspaceFiles: [{ path: 'file.txt', content: 'data' }],
        }),
      );

      // Directory exists
      const stat = await fs.stat(result.workspacePath);
      expect(stat.isDirectory()).toBe(true);

      // Cleanup
      await result.cleanup();

      // Directory is gone
      await expect(fs.stat(result.workspacePath)).rejects.toThrow();
    });
  });

  describe('path validation edge cases', () => {
    it('rejects rule names containing slashes', async () => {
      const scenario = makeScenario({
        rules: [{ name: 'bad/name', content: 'x' }],
      });
      await expect(builder.createWorkspace(scenario)).rejects.toThrow(
        'must be a simple name',
      );
    });

    it('rejects skill names containing slashes', async () => {
      const scenario = makeScenario({
        skills: [{ name: 'bad/name', content: 'x' }],
      });
      await expect(builder.createWorkspace(scenario)).rejects.toThrow(
        'must be a simple name',
      );
    });
  });
});
