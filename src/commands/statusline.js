import chalk from 'chalk';
import { formatTokenCount } from '../utils/tokens.js';

export default {
    name: 'statusline',
    description: 'Show context usage, token counts, and session info',
    usage: '/statusline',
    aliases: ['status'],

    async execute(args, { session, context, providerManager }) {
        const info = providerManager.getInfo();
        const messages = session.getMessages();
        const usage = context.estimateCurrentUsage(messages);
        const tokenUsage = context.getTokenUsage();
        const sessionId = session.currentSession?.id?.substring(0, 8) || 'none';
        const checkpoints = session.checkpoints?.length || 0;

        const w = 52;
        const sep = chalk.hex('#475569')('─'.repeat(w));
        const dimDot = chalk.hex('#475569')('·');

        console.log('');
        console.log(`  ${chalk.hex('#A78BFA').bold('✦ Session Status')}`);
        console.log(`  ${sep}`);
        console.log('');

        // Provider
        console.log(`  ${chalk.hex('#64748B')('Provider')}    ${providerManager.getStatusDisplay()}`);
        console.log(`  ${chalk.hex('#64748B')('Session')}     ${chalk.hex('#E2E8F0')(sessionId)} ${dimDot} ${chalk.hex('#94A3B8')(`${messages.length} messages`)} ${dimDot} ${chalk.hex('#94A3B8')(`${checkpoints} checkpoints`)}`);
        console.log('');

        // Context usage bar
        const pct = parseFloat(usage.percentage);
        const barWidth = 30;
        const filled = Math.round((pct / 100) * barWidth);
        const empty = barWidth - filled;
        const barColor = pct > 80 ? '#FB7185' : pct > 60 ? '#FBBF24' : '#A3E635';
        const bar = `${chalk.hex(barColor)('█'.repeat(filled))}${chalk.hex('#1E293B')('░'.repeat(empty))}`;

        console.log(`  ${chalk.hex('#64748B')('Context')}     ${bar}  ${chalk.hex(barColor).bold(`${pct.toFixed(1)}%`)}`);
        console.log(`  ${chalk.hex('#64748B')('Tokens')}      ${chalk.hex('#E2E8F0')(`~${formatTokenCount(usage.used)}`)} ${chalk.hex('#475569')('/')} ${chalk.hex('#94A3B8')(formatTokenCount(usage.max))}`);

        // API usage if any
        if (tokenUsage.total > 0) {
            console.log(`  ${chalk.hex('#64748B')('API Usage')}   ${chalk.hex('#38BDF8')(`↑ ${formatTokenCount(tokenUsage.prompt)}`)}  ${chalk.hex('#2DD4BF')(`↓ ${formatTokenCount(tokenUsage.completion)}`)}  ${chalk.hex('#94A3B8')(`Σ ${formatTokenCount(tokenUsage.total)}`)}`);
        }

        console.log('');
        console.log(`  ${sep}`);
        console.log('');
    },
};
