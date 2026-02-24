import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export default {
    name: 'skills',
    description: 'Discover, list, activate, and view skills',
    usage: '/skills [list|activate|deactivate|view|create] [name]',
    aliases: ['skill'],

    async execute(args, { skillsManager }) {
        if (!skillsManager) {
            console.log(chalk.red('  Skills system not available.'));
            return null;
        }

        const action = (args[0] || 'list').toLowerCase();

        switch (action) {
            case 'list': {
                const skills = skillsManager.list();
                console.log('');
                if (skills.length === 0) {
                    console.log(chalk.hex('#64748B')('  No skills found.'));
                    console.log(chalk.hex('#64748B')('  Create one with: /skills create <name>'));
                    console.log(chalk.hex('#64748B')('  Or add a SKILL.md to .agent/skills/<name>/'));
                } else {
                    console.log(chalk.hex('#A78BFA').bold('  Skills'));
                    console.log(chalk.hex('#475569')('  ' + '─'.repeat(50)));
                    for (const s of skills) {
                        const status = s.active
                            ? chalk.hex('#A3E635')('● active ')
                            : chalk.hex('#475569')('○ idle   ');
                        const extras = [
                            s.hasScripts ? chalk.hex('#22D3EE')('scripts') : null,
                            s.hasExamples ? chalk.hex('#FBBF24')('examples') : null,
                            s.hasResources ? chalk.hex('#FB7185')('resources') : null,
                        ].filter(Boolean);
                        const extrasStr = extras.length ? chalk.hex('#475569')(' [') + extras.join(chalk.hex('#475569')(', ')) + chalk.hex('#475569')(']') : '';
                        console.log(`  ${status} ${chalk.hex('#E2E8F0').bold(s.name.padEnd(20))} ${chalk.hex('#94A3B8')(s.description)}${extrasStr}`);
                    }
                }
                console.log('');
                return { skills };
            }

            case 'activate': case 'enable': case 'on': {
                const name = args[1];
                if (!name) {
                    console.log(chalk.yellow('  Usage: /skills activate <name>'));
                    return null;
                }
                if (skillsManager.activate(name)) {
                    console.log(chalk.hex('#A3E635')(`  ✓ Activated skill: ${name}`));
                    console.log(chalk.hex('#64748B')('  Its instructions will be included in the AI context.'));
                    return { activated: name };
                } else {
                    console.log(chalk.red(`  Skill not found: ${name}`));
                    return null;
                }
            }

            case 'deactivate': case 'disable': case 'off': {
                const name = args[1];
                if (!name) {
                    console.log(chalk.yellow('  Usage: /skills deactivate <name>'));
                    return null;
                }
                if (skillsManager.deactivate(name)) {
                    console.log(chalk.hex('#FBBF24')(`  ○ Deactivated skill: ${name}`));
                    return { deactivated: name };
                } else {
                    console.log(chalk.red(`  Skill "${name}" was not active.`));
                    return null;
                }
            }

            case 'view': case 'show': case 'info': {
                const name = args[1];
                if (!name) {
                    console.log(chalk.yellow('  Usage: /skills view <name>'));
                    return null;
                }
                const skill = skillsManager.getSkillContent(name);
                if (!skill) {
                    console.log(chalk.red(`  Skill not found: ${name}`));
                    return null;
                }
                console.log('');
                console.log(chalk.hex('#A78BFA').bold(`  Skill: ${skill.name}`));
                console.log(chalk.hex('#94A3B8')(`  ${skill.description}`));
                console.log(chalk.hex('#475569')(`  Dir: ${skill.dir}`));
                console.log(chalk.hex('#475569')(`  Status: ${skill.active ? 'active' : 'idle'}`));
                console.log(chalk.hex('#475569')('  ' + '─'.repeat(50)));
                console.log('');
                // Show body with slight indentation
                skill.body.split('\n').forEach(line => {
                    console.log(chalk.hex('#CBD5E1')(`  ${line}`));
                });
                console.log('');
                return { skill };
            }

            case 'create': case 'new': {
                const name = args[1];
                if (!name) {
                    console.log(chalk.yellow('  Usage: /skills create <name>'));
                    return null;
                }

                const skillDir = path.join(process.cwd(), '.agent', 'skills', name);
                const skillFile = path.join(skillDir, 'SKILL.md');

                if (fs.existsSync(skillFile)) {
                    console.log(chalk.yellow(`  Skill "${name}" already exists at ${skillDir}`));
                    return null;
                }

                // Create skill directory structure
                fs.mkdirSync(skillDir, { recursive: true });
                fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
                fs.mkdirSync(path.join(skillDir, 'examples'), { recursive: true });
                fs.mkdirSync(path.join(skillDir, 'resources'), { recursive: true });

                // Create SKILL.md template
                const template = `---
name: ${name}
description: Describe what this skill does
---

# ${name}

## Instructions

Add detailed step-by-step instructions here that the AI should follow when this skill is active.

## When to Use

Describe the scenarios where this skill should be activated.

## Steps

1. First step
2. Second step
3. Third step
`;

                fs.writeFileSync(skillFile, template, 'utf-8');

                console.log(chalk.hex('#A3E635')(`  ✓ Created skill: ${name}`));
                console.log(chalk.hex('#64748B')(`  Directory: ${skillDir}`));
                console.log(chalk.hex('#64748B')(`  Edit ${skillFile} to add instructions.`));
                console.log('');

                // Re-discover
                skillsManager.discover();

                return { created: name, dir: skillDir };
            }

            case 'refresh': case 'reload': {
                const count = skillsManager.discover();
                console.log(chalk.hex('#A3E635')(`  ✓ Discovered ${count} skills`));
                return { count };
            }

            default:
                console.log(chalk.yellow(`  Unknown action: ${action}`));
                console.log(chalk.hex('#64748B')('  Available: list, activate, deactivate, view, create, refresh'));
                return null;
        }
    },
};
