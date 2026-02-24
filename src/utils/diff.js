import { createPatch } from 'diff';
import chalk from 'chalk';

export function generateDiff(oldContent, newContent, filename = 'file') {
    return createPatch(filename, oldContent, newContent, 'original', 'modified');
}

export function formatDiff(diffText) {
    const lines = diffText.split('\n');
    const formatted = [];

    for (const line of lines) {
        if (line.startsWith('+++') || line.startsWith('---')) {
            formatted.push(chalk.bold(line));
        } else if (line.startsWith('@@')) {
            formatted.push(chalk.cyan(line));
        } else if (line.startsWith('+')) {
            formatted.push(chalk.green(line));
        } else if (line.startsWith('-')) {
            formatted.push(chalk.red(line));
        } else {
            formatted.push(chalk.dim(line));
        }
    }

    return formatted.join('\n');
}

export function displayDiff(oldContent, newContent, filename) {
    const patch = generateDiff(oldContent, newContent, filename);
    console.log('');
    console.log(chalk.bold.underline(`📝 Changes to ${filename}:`));
    console.log(formatDiff(patch));
    console.log('');
}
