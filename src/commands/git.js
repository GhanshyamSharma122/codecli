import chalk from 'chalk';

export default {
    name: 'git',
    description: 'Git integration — status, diff, log, branch, smart-commit',
    usage: '/git [status|diff|log|branch|commit|stage]',
    aliases: ['g'],

    async execute(args, { git, providerManager }) {
        if (!git) {
            console.log(chalk.red('  Git integration not available.'));
            return null;
        }

        if (!git.isGitRepo) {
            console.log(chalk.red('  Not a git repository.'));
            return null;
        }

        const action = (args[0] || 'status').toLowerCase();

        switch (action) {
            case 'status': {
                const status = git.status();
                console.log('');
                if (status.clean) {
                    console.log(chalk.green('  ✓ Working tree clean'));
                } else {
                    if (status.staged.length > 0) {
                        console.log(chalk.green('  Staged:'));
                        status.staged.forEach(f => console.log(chalk.green(`    + ${f}`)));
                    }
                    if (status.modified.length > 0) {
                        console.log(chalk.yellow('  Modified:'));
                        status.modified.forEach(f => console.log(chalk.yellow(`    ~ ${f}`)));
                    }
                    if (status.added.length > 0) {
                        console.log(chalk.cyan('  Added:'));
                        status.added.forEach(f => console.log(chalk.cyan(`    + ${f}`)));
                    }
                    if (status.deleted.length > 0) {
                        console.log(chalk.red('  Deleted:'));
                        status.deleted.forEach(f => console.log(chalk.red(`    - ${f}`)));
                    }
                    if (status.untracked.length > 0) {
                        console.log(chalk.dim('  Untracked:'));
                        status.untracked.forEach(f => console.log(chalk.dim(`    ? ${f}`)));
                    }
                    console.log(chalk.dim(`\n  Total changes: ${status.total}`));
                }
                console.log('');
                return status;
            }

            case 'diff': {
                const staged = args[1] === '--staged' || args[1] === '-s';
                const diff = git.diff(staged);
                if (!diff) {
                    console.log(chalk.dim('  No differences.'));
                } else {
                    console.log('');
                    // Colorize diff output
                    diff.split('\n').forEach(line => {
                        if (line.startsWith('+') && !line.startsWith('+++')) {
                            console.log(chalk.green(`  ${line}`));
                        } else if (line.startsWith('-') && !line.startsWith('---')) {
                            console.log(chalk.red(`  ${line}`));
                        } else if (line.startsWith('@@')) {
                            console.log(chalk.cyan(`  ${line}`));
                        } else {
                            console.log(chalk.dim(`  ${line}`));
                        }
                    });
                    console.log('');
                }
                return { diff };
            }

            case 'log': {
                const count = parseInt(args[1]) || 10;
                const logs = git.log(count);
                console.log('');
                console.log(chalk.bold('  Recent commits:'));
                logs.forEach(entry => {
                    const [hash, ...rest] = entry.split(' ');
                    console.log(`  ${chalk.yellow(hash)} ${rest.join(' ')}`);
                });
                console.log('');
                return { logs };
            }

            case 'branch': {
                const info = git.branch();
                console.log('');
                console.log(chalk.bold(`  Current: ${chalk.green(info.current)}`));
                console.log(chalk.dim('  Branches:'));
                info.branches.forEach(b => {
                    const isCurrent = b === info.current;
                    console.log(`    ${isCurrent ? chalk.green('* ' + b) : chalk.dim('  ' + b)}`);
                });
                console.log('');
                return info;
            }

            case 'commit': {
                // AI-powered smart commit
                const message = await git.smartCommit(providerManager);
                if (message) {
                    console.log('');
                    console.log(chalk.bold('  Suggested commit message:'));
                    console.log(chalk.cyan(`  "${message}"`));
                    console.log('');
                    console.log(chalk.dim('  To commit, run: !git commit -m "' + message + '"'));
                    console.log(chalk.dim('  Or use: /git stage then /git commit to auto-commit'));
                }
                return { message };
            }

            case 'stage': {
                git.stageAll();
                return { staged: true };
            }

            case 'auto': case 'autocommit': {
                // Stage all + smart commit + execute
                git.stageAll();
                const msg = await git.smartCommit(providerManager);
                if (msg) {
                    git.commit(msg);
                    return { committed: true, message: msg };
                }
                return { committed: false };
            }

            case 'new-branch': case 'checkout': {
                const branchName = args[1];
                if (!branchName) {
                    console.log(chalk.red('  Usage: /git new-branch <name>'));
                    return null;
                }
                git.createBranch(branchName);
                return { branch: branchName };
            }

            default:
                console.log(chalk.yellow(`  Unknown git action: ${action}`));
                console.log(chalk.dim('  Available: status, diff, log, branch, commit, stage, auto, new-branch'));
                return null;
        }
    },
};
