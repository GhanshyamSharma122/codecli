import chalk from 'chalk';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import wrapAnsi from 'wrap-ansi';
import theme from './theme.js';

/**
 * Simple typewriter animation
 */
async function typewriter(text, speed = 10) {
    for (const char of text) {
        process.stdout.write(char);
        await new Promise(resolve => setTimeout(resolve, speed));
    }
}

class Renderer {
    constructor() {
        this.buffer = '';
        this.isStreaming = false;
        this.currentCol = 0;
    }

    _getMarkedOptions() {
        const { contentWidth } = theme.layout;
        return {
            code: chalk.hex('#E2E8F0').bgHex('#1E293B'),
            codespan: chalk.hex('#FB923C').bold,
            blockquote: chalk.hex('#94A3B8').italic,
            html: chalk.dim,
            heading: chalk.hex('#A78BFA').bold,
            firstHeading: chalk.hex('#A78BFA').bold.underline,
            hr: chalk.hex('#475569'),
            listitem: chalk.hex('#E2E8F0'),
            list: chalk.hex('#E2E8F0'),
            table: chalk.hex('#E2E8F0'),
            paragraph: chalk.hex('#E2E8F0'),
            strong: chalk.hex('#F8FAFC').bold,
            em: chalk.hex('#CBD5E1').italic,
            link: chalk.hex('#38BDF8').underline,
            del: chalk.dim.strikethrough,
            tab: 2,
            emoji: true,
            width: contentWidth,
            showSectionPrefix: false,
            reflowText: true,
            unescape: true,
        };
    }

    renderMarkdown(text) {
        if (!text) return;
        const { gutterStr } = theme.layout;
        const localMarked = new Marked();
        localMarked.use(markedTerminal(this._getMarkedOptions()));

        try {
            const rendered = localMarked.parse(text);
            const indented = rendered.split('\n').map(l => gutterStr + l).join('\n');
            process.stdout.write(indented);
        } catch {
            process.stdout.write(gutterStr + text);
        }
    }

    streamChunk(chunk) {
        const { gutterStr, contentWidth } = theme.layout;
        if (!this.isStreaming) {
            this.isStreaming = true;
            this.buffer = '';
            this.currentCol = 0;
            process.stdout.write(gutterStr);
        }

        this.buffer += chunk;

        const color = chalk.hex('#E2E8F0');
        const lines = chunk.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (i > 0) {
                process.stdout.write('\n' + gutterStr);
                this.currentCol = 0;
            }

            const words = line.split(/(\s+)/);
            for (const part of words) {
                if (!part) continue;
                const stripped = part.replace(/\x1B\[\d+[;\d]*m/g, '');

                if (this.currentCol + stripped.length > contentWidth && this.currentCol > 0) {
                    process.stdout.write('\n' + gutterStr);
                    this.currentCol = 0;
                }

                process.stdout.write(color(part));
                this.currentCol += stripped.length;
            }
        }
    }

    endStream() {
        if (this.isStreaming) {
            process.stdout.write('\n');
        }
        this.buffer = '';
        this.currentCol = 0;
        this.isStreaming = false;
    }

    async renderWelcome(providerInfo, tokenInfo = null) {
        const { gutterStr } = theme.layout;
        console.log('');

        const bannerLines = [
            '██████╗ ██████╗ ██████╗ ███████╗ ██████╗██╗     ██╗',
            '██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝██║     ██║',
            '██║     ██║   ██║██║  ██║█████╗  ██║     ██║     ██║',
            '██║     ██║   ██║██║  ██║██╔══╝  ██║     ██║     ██║',
            '╚██████╗╚██████╔╝██████╔╝███████╗╚██████╗███████╗██║',
            ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝╚══════╝╚═╝',
        ];

        const gradientColors = ['#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6'];
        for (let i = 0; i < bannerLines.length; i++) {
            process.stdout.write(gutterStr + chalk.hex(gradientColors[i])(bannerLines[i]) + '\n');
            await new Promise(resolve => setTimeout(resolve, 30));
        }

        console.log('');
        process.stdout.write(gutterStr + chalk.hex('#A78BFA').bold('AI-Powered Coding Assistant') + '\n');
        process.stdout.write(gutterStr + chalk.hex('#475569')('─'.repeat(40)) + '\n\n');

        const info = [
            `${chalk.hex('#64748B')('Provider')}  ${providerInfo}`,
            `${chalk.hex('#64748B')('Directory')} ${chalk.hex('#E2E8F0')(process.cwd())}`
        ];
        if (tokenInfo) info.push(`${chalk.hex('#64748B')('Context')}   ${chalk.hex('#E2E8F0')(tokenInfo)}`);

        process.stdout.write(theme.panel(info.join('\n'), { border: false }));

        console.log('\n');
        const commands = [
            `${chalk.hex('#A78BFA')('/help')}`,
            `${chalk.hex('#22D3EE')('/model')}`,
            `${chalk.hex('#2DD4BF')('/git')}`,
            `${chalk.hex('#FBBF24')('/agent')}`,
            `${chalk.hex('#FB7185')('/team')}`
        ];
        process.stdout.write(gutterStr + chalk.hex('#64748B')('Commands  ') + commands.join(chalk.hex('#475569')(' · ')) + '\n');
        process.stdout.write(gutterStr + chalk.hex('#64748B')('Shortcuts ') + chalk.hex('#CBD5E1')('! shell · @ file · > ultrathink') + '\n');

        process.stdout.write('\n' + theme.heavySep() + '\n');
    }

    renderToolResult(toolName, result) {
        const { gutterStr } = theme.layout;
        let output = '';

        if (result.error) {
            output = theme.error(`${theme.symbols.cross} ${toolName}: ${result.error}`);
        } else if (result.success !== undefined) {
            return;
        } else {
            const icon = toolName === 'read_file' ? '📄' : toolName.includes('search') ? '🔍' : '📁';
            const detail = result.content ? `${result.totalLines || '?'} lines` :
                result.matches ? `${result.matches.length} matches` :
                    result.entries ? `${result.entries.length} entries` : '';
            output = chalk.dim(`${icon} ${toolName} ${theme.symbols.dot} ${detail}`);
        }

        process.stdout.write(gutterStr + output + '\n');
    }

    async renderError(error) {
        const { gutterStr } = theme.layout;
        process.stdout.write('\n' + gutterStr);
        await typewriter(theme.error(`${theme.symbols.cross} Error: `) + chalk.hex('#FCA5A5')(error.message || error));
        process.stdout.write('\n\n');
    }

    async renderCompacting() {
        const { gutterStr } = theme.layout;
        process.stdout.write('\n' + gutterStr);
        await typewriter(chalk.hex('#FBBF24')('⚡ ') + chalk.hex('#FBBF24').bold('Auto-compacting conversation') + chalk.hex('#64748B')(' — window limit'));
        process.stdout.write('\n');
    }

    renderCompacted(before, after) {
        const { gutterStr } = theme.layout;
        process.stdout.write(gutterStr + chalk.hex('#A3E635')(theme.symbols.check) + ' ' + chalk.hex('#A3E635')('Compacted: ') + chalk.hex('#94A3B8')(`${before} → ${after} msgs`) + '\n\n');
    }

    renderTokenUsage(usage) {
        const { gutterStr } = theme.layout;
        const bar = theme.tokenBar(usage.used, usage.max);
        process.stdout.write(gutterStr + chalk.hex('#64748B')('Tokens ') + bar + ' ' + chalk.hex('#64748B')(`${usage.used.toLocaleString()} / ${usage.max.toLocaleString()}`) + '\n');
    }

    renderStatus(info) {
        const { gutterStr } = theme.layout;
        const parts = [
            chalk.hex('#475569')(theme.symbols.sep),
            info.provider,
            info.tokens ? chalk.hex('#475569')(theme.symbols.sep) + ' ' + info.tokens : '',
            info.messages ? chalk.hex('#475569')(theme.symbols.sep) + ` ${chalk.hex('#94A3B8')(info.messages + ' msgs')}` : ''
        ].filter(Boolean);
        process.stdout.write(gutterStr + parts.join(' ') + '\n');
    }
}

export default Renderer;
