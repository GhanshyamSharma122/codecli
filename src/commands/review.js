import chalk from 'chalk';
import { execSync } from 'child_process';

export default {
    name: 'review',
    description: 'AI-powered code review of modified/staged files',
    usage: '/review [file]',

    async execute(args, { session, providerManager, context, toolExecutor }) {
        console.log(chalk.cyan('  🔍 Starting code review...'));

        let filesToReview = [];

        if (args.length > 0) {
            filesToReview = args;
        } else {
            // Get git modified files
            try {
                const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim();
                const modified = execSync('git diff --name-only', { encoding: 'utf-8' }).trim();
                const files = [...new Set([
                    ...(staged ? staged.split('\n') : []),
                    ...(modified ? modified.split('\n') : []),
                ])];
                filesToReview = files.filter(Boolean);
            } catch {
                console.log(chalk.yellow('  Not a git repository or no modified files.'));
                console.log(chalk.dim('  Usage: /review <file1> <file2> ...'));
                return;
            }
        }

        if (filesToReview.length === 0) {
            console.log(chalk.yellow('  No files to review.'));
            return;
        }

        console.log(chalk.dim(`  Reviewing ${filesToReview.length} file(s)...`));

        // Build review prompt
        let diff = '';
        try {
            diff = execSync('git diff --cached', { encoding: 'utf-8' });
            if (!diff) diff = execSync('git diff', { encoding: 'utf-8' });
        } catch {
            diff = '';
        }

        const reviewPrompt = `Please review the following code changes and provide feedback on:
1. **Bugs & Issues**: Any potential bugs, logic errors, or edge cases
2. **Security**: Security vulnerabilities or concerns
3. **Performance**: Performance issues or optimizations
4. **Style**: Code style, naming, and best practices
5. **Suggestions**: Improvements and refactoring suggestions

Files changed: ${filesToReview.join(', ')}

${diff ? `\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\`` : 'Please read the files and review them.'}`;

        // This returns the prompt to be sent as a message
        return { reviewPrompt, files: filesToReview };
    },
};
