import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';

class Permissions {
    constructor(config) {
        this.config = config;
        this.sessionApprovals = new Set();
        this.sessionDenials = new Set();
        this.godMode = false;
        this.godModeCwd = null; // restrict god mode to this directory
    }

    get settings() {
        return this.config.get('permissions') || {};
    }

    /**
     * Enable god mode — auto-approve all operations within the working directory.
     */
    enableGodMode(cwd = process.cwd()) {
        this.godMode = true;
        this.godModeCwd = path.resolve(cwd);
        console.log('');
        console.log(`  ${chalk.hex('#FBBF24').bold('⚡ GOD MODE ENABLED')}`);
        console.log(`  ${chalk.hex('#64748B')('Auto-approving all operations in:')} ${chalk.hex('#E2E8F0')(this.godModeCwd)}`);
        console.log(`  ${chalk.hex('#FB7185')('No permission prompts will be shown.')}`);
        console.log('');
    }

    disableGodMode() {
        this.godMode = false;
        this.godModeCwd = null;
    }

    /**
     * Check if a path is within the god mode directory.
     */
    _isInGodModeScope(targetPath) {
        if (!this.godMode || !this.godModeCwd) return false;
        const resolved = path.resolve(targetPath);
        return resolved.startsWith(this.godModeCwd);
    }

    async checkRead(filePath) {
        if (this.godMode && this._isInGodModeScope(filePath)) return true;
        if (this.settings.autoApproveRead) return true;
        return this._prompt('read', filePath);
    }

    async checkWrite(filePath) {
        if (this.godMode && this._isInGodModeScope(filePath)) return true;
        if (this.settings.autoApproveWrite) return true;
        const key = `write:${filePath}`;
        if (this.sessionApprovals.has(key)) return true;
        if (this.sessionDenials.has(key)) return false;
        return this._prompt('write', filePath);
    }

    async checkExecute(command) {
        if (this.godMode) return true;
        if (this.settings.autoApproveExecute) return true;

        // Check allowed commands
        const allowed = this.settings.allowedCommands || [];
        if (allowed.some((cmd) => command.startsWith(cmd))) return true;

        // Check blocked commands
        const blocked = this.settings.blockedCommands || [];
        if (blocked.some((cmd) => command.includes(cmd))) {
            console.log(chalk.red.bold('⛔ Command blocked by security policy:'), chalk.red(command));
            return false;
        }

        const key = `exec:${command}`;
        if (this.sessionApprovals.has(key)) return true;
        if (this.sessionDenials.has(key)) return false;

        return this._prompt('execute', command);
    }

    async _prompt(action, target) {
        const icons = { read: '📖', write: '✏️', execute: '⚡' };
        const colors = { read: 'cyan', write: 'yellow', execute: 'red' };

        console.log('');
        console.log(chalk[colors[action]].bold(`${icons[action]}  Permission Required: ${action.toUpperCase()}`));
        console.log(chalk.dim(`   Target: ${target}`));
        console.log('');

        const { decision } = await inquirer.prompt([
            {
                type: 'list',
                name: 'decision',
                message: `Allow ${action}?`,
                choices: [
                    { name: 'Yes (this time)', value: 'yes' },
                    { name: 'Yes (for this session)', value: 'always' },
                    { name: 'No', value: 'no' },
                ],
            },
        ]);

        const key = `${action}:${target}`;

        if (decision === 'yes') return true;
        if (decision === 'always') {
            this.sessionApprovals.add(key);
            return true;
        }

        this.sessionDenials.add(key);
        return false;
    }

    resetSession() {
        this.sessionApprovals.clear();
        this.sessionDenials.clear();
    }
}

export default Permissions;
