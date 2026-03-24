// ---------------------------------------------------------------------------
// WorkspaceBuilder — creates isolated temp directories for each run
// ---------------------------------------------------------------------------

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { IWorkspaceBuilder, WorkspaceResult } from '../interfaces/workspace.js';
import type { TestSetup, Scenario, ClaudeMdEntry, RuleEntry, SkillEntry, WorkspaceFile } from '../types/index.js';

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/** Reject absolute paths and path traversal attempts. */
function assertSafePath(value: string, label: string): void {
  if (path.isAbsolute(value)) {
    throw new PathValidationError(`${label} must not be an absolute path: ${value}`);
  }
  const normalized = path.normalize(value);
  if (normalized.startsWith('..') || normalized.includes(`${path.sep}..`)) {
    throw new PathValidationError(`${label} must not contain '..': ${value}`);
  }
}

function assertSafeName(value: string, label: string): void {
  if (value.includes('..') || value.includes(path.sep) || value.includes('/')) {
    throw new PathValidationError(`${label} must be a simple name, got: ${value}`);
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class WorkspaceBuilder implements IWorkspaceBuilder {
  async createWorkspace(setup: TestSetup, scenario: Scenario): Promise<WorkspaceResult> {
    const workspacePath = path.join(os.tmpdir(), `ctb-run-${randomUUID()}`);
    await fs.mkdir(workspacePath, { recursive: true });

    try {
      await this.writeClaudeMdFiles(workspacePath, setup.claudeMdFiles);
      await this.writeRules(workspacePath, setup.rules);
      await this.writeSkills(workspacePath, setup.skills);
      await this.writeWorkspaceFiles(workspacePath, scenario.workspaceFiles);
    } catch (err) {
      // Cleanup on failure
      await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => {});
      throw err;
    }

    return {
      workspacePath,
      cleanup: async () => {
        await fs.rm(workspacePath, { recursive: true, force: true });
      },
    };
  }

  // ─── CLAUDE.md files ────────────────────────────────────────────────

  private async writeClaudeMdFiles(
    root: string,
    entries: readonly ClaudeMdEntry[],
  ): Promise<void> {
    for (const entry of entries) {
      const content = await this.resolveContent(entry.content, entry.loadFromFile);

      if (entry.role === 'project') {
        await fs.writeFile(path.join(root, 'CLAUDE.md'), content, 'utf-8');
      } else {
        const claudeDir = path.join(root, '.claude');
        await fs.mkdir(claudeDir, { recursive: true });
        await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), content, 'utf-8');
      }
    }
  }

  // ─── Rules ──────────────────────────────────────────────────────────

  private async writeRules(
    root: string,
    rules: readonly RuleEntry[],
  ): Promise<void> {
    if (rules.length === 0) return;

    const rulesDir = path.join(root, '.claude', 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    for (const rule of rules) {
      assertSafeName(rule.name, 'rule name');
      const content = await this.resolveContent(rule.content, rule.loadFromFile);
      await fs.writeFile(path.join(rulesDir, `${rule.name}.md`), content, 'utf-8');
    }
  }

  // ─── Skills ─────────────────────────────────────────────────────────

  private async writeSkills(
    root: string,
    skills: readonly SkillEntry[],
  ): Promise<void> {
    if (skills.length === 0) return;

    const skillsBase = path.join(root, '.claude', 'skills');

    for (const skill of skills) {
      assertSafeName(skill.name, 'skill name');
      const skillDir = path.join(skillsBase, skill.name);
      await fs.mkdir(skillDir, { recursive: true });

      const content = await this.resolveContent(skill.content, skill.loadFromFile);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
    }
  }

  // ─── Workspace files ───────────────────────────────────────────────

  private async writeWorkspaceFiles(
    root: string,
    files: readonly WorkspaceFile[],
  ): Promise<void> {
    for (const file of files) {
      assertSafePath(file.path, 'workspace file path');
      const target = path.join(root, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, 'utf-8');
    }
  }

  // ─── Content resolution ────────────────────────────────────────────

  private async resolveContent(
    inlineContent: string,
    loadFromFile?: string,
  ): Promise<string> {
    if (loadFromFile) {
      return fs.readFile(loadFromFile, 'utf-8');
    }
    return inlineContent;
  }
}
