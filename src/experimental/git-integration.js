import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Git integration helpers for commit, branch, PR, and diff analysis.
 */
class GitIntegration {
    constructor() {
        this.isGitRepo = this._checkGitRepo();
    }

    _checkGitRepo() {
        try {
            execSync('git rev-parse --git-dir', { encoding: 'utf-8', stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    _exec(cmd) {
        try {
            return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
        } catch (err) {
            throw new Error(`Git error: ${err.stderr || err.message}`);
        }
    }

    status() {
        if (!this.isGitRepo) return { error: 'Not a git repository' };
        const output = this._exec('git status --porcelain');
        const lines = output.split('\n').filter(Boolean);
        return {
            modified: lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).map(l => l.slice(3)),
            added: lines.filter(l => l.startsWith('A ') || l.startsWith('?')).map(l => l.slice(3)),
            deleted: lines.filter(l => l.startsWith(' D') || l.startsWith('D ')).map(l => l.slice(3)),
            staged: lines.filter(l => !l.startsWith('?') && !l.startsWith(' ')).map(l => l.slice(3)),
            untracked: lines.filter(l => l.startsWith('??')).map(l => l.slice(3)),
            total: lines.length,
            clean: lines.length === 0,
        };
    }

    diff(staged = false) {
        if (!this.isGitRepo) return '';
        return this._exec(`git diff ${staged ? '--cached' : ''}`);
    }

    log(count = 10) {
        if (!this.isGitRepo) return [];
        const output = this._exec(`git log -${count} --oneline --format="%h %s (%ar)"`);
        return output.split('\n').filter(Boolean);
    }

    branch() {
        if (!this.isGitRepo) return { current: null, branches: [] };
        const current = this._exec('git branch --show-current');
        const all = this._exec('git branch -a').split('\n').map(b => b.trim().replace(/^\* /, ''));
        return { current, branches: all };
    }

    async smartCommit(providerManager) {
        if (!this.isGitRepo) {
            console.log(chalk.red('  Not a git repository'));
            return null;
        }

        const staged = this.diff(true);
        if (!staged) {
            console.log(chalk.yellow('  No staged changes. Use `git add` first.'));
            return null;
        }

        // Generate commit message using AI
        console.log(chalk.cyan('  Generating commit message...'));
        const prompt = `Generate a conventional commit message for these changes. Use the conventional commits format (feat:, fix:, chore:, docs:, refactor:, etc.). Be concise but descriptive. Return ONLY the commit message, nothing else.

Diff:
\`\`\`
${staged.substring(0, 3000)}
\`\`\``;

        const result = await providerManager.provider.chat(
            [{ role: 'user', content: prompt }],
            { temperature: 0.3, maxTokens: 200 }
        );

        const message = result.content.trim().replace(/^["']|["']$/g, '');
        console.log(chalk.dim(`  Message: ${message}`));

        return message;
    }

    createBranch(name) {
        this._exec(`git checkout -b ${name}`);
        console.log(chalk.green(`  ✓ Created and switched to branch: ${name}`));
    }

    stageAll() {
        this._exec('git add -A');
        console.log(chalk.green('  ✓ Staged all changes'));
    }

    commit(message) {
        this._exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
        console.log(chalk.green(`  ✓ Committed: ${message}`));
    }
}

export default GitIntegration;
