import chalk from 'chalk';
import theme from '../ui/theme.js';

export default {
    name: 'help',
    description: 'Show available commands and usage',
    usage: '/help',
    aliases: ['h', '?'],

    async execute(args, { commands }) {
        console.log('');
        console.log(theme.header('  CodeCLI Commands'));
        console.log(theme.separator());
        console.log('');

        const allCommands = commands.getCommands();
        const maxNameLen = Math.max(...allCommands.map(c => c.name.length));

        for (const cmd of allCommands) {
            const name = `/${cmd.name}`.padEnd(maxNameLen + 2);
            console.log(`  ${theme.primary(name)} ${chalk.dim(cmd.description)}`);
        }

        console.log('');
        console.log(theme.separator('Special Syntax'));
        console.log('');
        console.log(`  ${theme.primary('! <command>')}  ${chalk.dim('Execute a shell command directly')}`);
        console.log(`  ${theme.primary('@ <file>')}     ${chalk.dim('Reference a file in your prompt')}`);
        console.log(`  ${theme.primary('> ultrathink')} ${chalk.dim('Enable extended thinking for next response')}`);
        console.log('');
        console.log(theme.separator('Keyboard Shortcuts'));
        console.log('');
        console.log(`  ${theme.primary('Ctrl+C')}       ${chalk.dim('Cancel current response / Exit')}`);
        console.log(`  ${theme.primary('Ctrl+D')}       ${chalk.dim('Exit CodeCLI')}`);
        console.log(`  ${theme.primary('Up/Down')}      ${chalk.dim('Navigate input history')}`);
        console.log('');

        return { shown: true };
    },
};
