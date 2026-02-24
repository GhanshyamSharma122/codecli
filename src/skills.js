import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * SkillsManager — discovers, loads, and manages skills.
 *
 * Skills are folders containing a SKILL.md file with YAML frontmatter
 * (name, description) and detailed markdown instructions.
 * Optional subdirectories: scripts/, examples/, resources/
 *
 * Search locations (in order):
 *   1. <project>/.agent/skills/
 *   2. <project>/skills/
 *   3. <globalConfig>/skills/
 */
class SkillsManager {
    constructor(config) {
        this.config = config;
        this.skills = new Map();       // name -> skill object
        this.activeSkills = new Set(); // names of currently active skills
        this.searchPaths = [];
    }

    /**
     * Discover skills from all search locations.
     */
    discover(cwd = process.cwd()) {
        this.searchPaths = [
            path.join(cwd, '.agent', 'skills'),
            path.join(cwd, 'skills'),
            path.join(this.config.globalConfigDir, 'skills'),
        ];

        this.skills.clear();

        for (const searchDir of this.searchPaths) {
            if (!fs.existsSync(searchDir)) continue;

            const entries = fs.readdirSync(searchDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const skillDir = path.join(searchDir, entry.name);
                const skillFile = path.join(skillDir, 'SKILL.md');

                if (!fs.existsSync(skillFile)) continue;

                try {
                    const skill = this._parseSkill(skillFile, skillDir, entry.name);
                    if (skill && !this.skills.has(skill.name)) {
                        this.skills.set(skill.name, skill);
                    }
                } catch (err) {
                    // Skip malformed skills silently
                }
            }
        }

        return this.skills.size;
    }

    /**
     * Parse a SKILL.md file into a skill object.
     */
    _parseSkill(skillFile, skillDir, folderName) {
        const raw = fs.readFileSync(skillFile, 'utf-8');

        // Parse YAML frontmatter
        let name = folderName;
        let description = '';
        let body = raw;

        const frontmatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
        if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1];
            body = frontmatterMatch[2];

            // Simple YAML key-value parsing
            for (const line of frontmatter.split('\n')) {
                const match = line.match(/^(\w+):\s*(.+)$/);
                if (match) {
                    const [, key, value] = match;
                    if (key === 'name') name = value.trim();
                    if (key === 'description') description = value.trim();
                }
            }
        }

        // Detect available subdirectories
        const hasScripts = fs.existsSync(path.join(skillDir, 'scripts'));
        const hasExamples = fs.existsSync(path.join(skillDir, 'examples'));
        const hasResources = fs.existsSync(path.join(skillDir, 'resources'));

        // List script files if present
        const scripts = hasScripts
            ? fs.readdirSync(path.join(skillDir, 'scripts')).filter(f => !f.startsWith('.'))
            : [];

        return {
            name,
            description,
            body,
            dir: skillDir,
            file: skillFile,
            hasScripts,
            hasExamples,
            hasResources,
            scripts,
        };
    }

    /**
     * Activate a skill by name.
     */
    activate(name) {
        if (!this.skills.has(name)) {
            return false;
        }
        this.activeSkills.add(name);
        return true;
    }

    /**
     * Deactivate a skill by name.
     */
    deactivate(name) {
        return this.activeSkills.delete(name);
    }

    /**
     * Auto-activate skills whose description matches a user prompt.
     * Returns list of newly activated skill names.
     */
    autoActivate(userPrompt) {
        const activated = [];
        const lower = userPrompt.toLowerCase();

        for (const [name, skill] of this.skills) {
            if (this.activeSkills.has(name)) continue;

            // Check if skill name or description keywords appear in prompt
            const keywords = [
                name.toLowerCase(),
                ...skill.description.toLowerCase().split(/\s+/),
            ].filter(k => k.length > 3);

            for (const keyword of keywords) {
                if (lower.includes(keyword)) {
                    this.activeSkills.add(name);
                    activated.push(name);
                    break;
                }
            }
        }

        return activated;
    }

    /**
     * Get the system prompt injection for all active skills.
     */
    getActiveSkillsPrompt() {
        if (this.activeSkills.size === 0) return '';

        const parts = ['## Active Skills'];

        for (const name of this.activeSkills) {
            const skill = this.skills.get(name);
            if (!skill) continue;

            parts.push(`### Skill: ${skill.name}`);
            if (skill.description) {
                parts.push(`*${skill.description}*`);
            }
            parts.push(skill.body);

            if (skill.scripts.length > 0) {
                parts.push(`\nAvailable scripts in ${skill.dir}/scripts/:`);
                skill.scripts.forEach(s => parts.push(`- ${s}`));
            }
        }

        return parts.join('\n\n');
    }

    /**
     * List all discovered skills with their status.
     */
    list() {
        return Array.from(this.skills.values()).map(s => ({
            name: s.name,
            description: s.description,
            active: this.activeSkills.has(s.name),
            dir: s.dir,
            hasScripts: s.hasScripts,
            hasExamples: s.hasExamples,
            hasResources: s.hasResources,
        }));
    }

    /**
     * Read the full content of a skill (for /skills view <name>).
     */
    getSkillContent(name) {
        const skill = this.skills.get(name);
        if (!skill) return null;
        return {
            ...skill,
            active: this.activeSkills.has(name),
        };
    }
}

export default SkillsManager;
