import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import theme from '../ui/theme.js';

// Import all commands
import clearCmd from './clear.js';
import compactCmd from './compact.js';
import helpCmd from './help.js';
import modelCmd from './model.js';
import reviewCmd from './review.js';
import rewindCmd from './rewind.js';
import tasksCmd from './tasks.js';
import statuslineCmd from './statusline.js';
import configCmd from './config-cmd.js';

// Experimental commands
import gitCmd from './git.js';
import agentCmd from './agent.js';
import teamCmd from './team.js';
import mcpCmd from './mcp-cmd.js';
import skillsCmd from './skills.js';
import godCmd from './god.js';
import providerCmd from './provider.js';

class CommandRegistry {
    constructor() {
        this.commands = new Map();

        // Register built-in commands
        [clearCmd, compactCmd, helpCmd, modelCmd, reviewCmd,
            rewindCmd, tasksCmd, statuslineCmd, configCmd,
            // Experimental
            gitCmd, agentCmd, teamCmd, mcpCmd, skillsCmd, godCmd,
            providerCmd,
        ].forEach(cmd => {
            this.commands.set(cmd.name, cmd);
            if (cmd.aliases) {
                cmd.aliases.forEach(alias => this.commands.set(alias, cmd));
            }
        });
    }

    isCommand(input) {
        return input.startsWith('/');
    }

    async execute(input, context) {
        const parts = input.slice(1).split(/\s+/);
        const name = parts[0].toLowerCase();
        const args = parts.slice(1);

        const command = this.commands.get(name);
        if (!command) {
            console.log(theme.error(`Unknown command: /${name}. Type /help for available commands.`));
            return null;
        }

        try {
            return await command.execute(args, context);
        } catch (err) {
            console.log(theme.error(`Command error: ${err.message}`));
            return null;
        }
    }

    getCommands() {
        // Deduplicate (aliases point to same command)
        const seen = new Set();
        const commands = [];
        for (const [name, cmd] of this.commands) {
            if (!seen.has(cmd.name)) {
                seen.add(cmd.name);
                commands.push(cmd);
            }
        }
        return commands;
    }
}

export default CommandRegistry;
