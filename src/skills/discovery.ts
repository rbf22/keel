// discovery.ts
// Handles discovery of built-in skills using Vite's glob feature.
// This is separated into its own file to allow for easier mocking in tests.

// Discover all SKILL.md files (eagerly loaded for Tier 1 metadata)
export const SKILL_FILES = import.meta.glob('./**/SKILL.md', { query: '?raw', import: 'default', eager: true });

// Discover all script files (lazy loaded)
export const SCRIPT_FILES = import.meta.glob('./**/scripts/*.py', { query: '?raw', import: 'default' });

// Discover all reference files (lazy loaded)
export const REFERENCE_FILES = import.meta.glob('./**/references/*.md', { query: '?raw', import: 'default' });
