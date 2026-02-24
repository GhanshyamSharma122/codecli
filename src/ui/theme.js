import chalk from 'chalk';

// ━━━ Premium color palette ━━━
const purple = chalk.hex('#A78BFA');
const violet = chalk.hex('#8B5CF6');
const cyan = chalk.hex('#22D3EE');
const teal = chalk.hex('#2DD4BF');
const amber = chalk.hex('#FBBF24');
const rose = chalk.hex('#FB7185');
const sky = chalk.hex('#38BDF8');
const lime = chalk.hex('#A3E635');
const slate = chalk.hex('#94A3B8');
const zinc = chalk.hex('#71717A');
const white = chalk.hex('#F8FAFC');
const dimWhite = chalk.hex('#CBD5E1');

const theme = {
    // Brand colors
    primary: violet,
    secondary: cyan,
    accent: amber,
    success: lime,
    error: rose,
    warning: amber,
    info: sky,

    // Text styles
    dim: chalk.dim,
    bold: chalk.bold,
    italic: chalk.italic,
    underline: chalk.underline,

    // UI elements
    border: zinc,
    header: violet.bold,
    prompt: purple.bold,
    userInput: white,
    assistantText: dimWhite,
    toolName: cyan,
    toolArgs: slate,
    fileName: sky,
    lineNumber: slate,
    codeBlock: dimWhite,

    // Provider colors
    providerColors: {
        'azure-openai': chalk.hex('#0078D4'),
        ollama: chalk.hex('#FF6F00'),
        gemini: chalk.hex('#4285F4'),
    },

    // Gradient text helper
    gradient(text) {
        const colors = ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'];
        return text.split('').map((char, i) =>
            chalk.hex(colors[i % colors.length])(char)
        ).join('');
    },

    // Layout and spacing
    get layout() {
        const width = process.stdout.columns || 80;
        const gutter = 2;
        const gutterStr = ' '.repeat(gutter);
        const contentWidth = Math.max(40, width - (gutter * 2));

        return {
            width,
            contentWidth,
            gutter,
            gutterStr,
            isSmall: width < 100
        };
    },

    // Symbols for a modern look
    symbols: {
        bullet: '●',
        diamond: '◆',
        check: '✓',
        cross: '✗',
        info: 'ℹ',
        warning: '⚠',
        sparkle: '✦',
        arrow: '❯',
        dot: '·',
        sep: '│'
    },

    // Panel helper for boxed or guttered content
    panel(content, options = {}) {
        const { width, gutterStr } = this.layout;
        const title = options.title ? ` ${options.title} ` : '';
        const borderColor = options.color || zinc;

        const lines = content.split('\n');
        const contentLines = lines.map(line => `${gutterStr}${line}`);

        if (options.border === false) {
            return contentLines.join('\n');
        }

        // Boxed version
        const h = this.box.horizontal;
        const boxWidth = Math.min(width - gutterStr.length * 2, this.layout.contentWidth);

        const top = gutterStr + borderColor(this.box.topLeft + (title ? borderColor.bold(title) : h).padEnd(boxWidth - 2, h) + this.box.topRight);
        const bottom = gutterStr + borderColor(this.box.bottomLeft + h.repeat(boxWidth - 2) + this.box.bottomRight);
        const middle = lines.map(l =>
            gutterStr + borderColor(this.box.vertical) + ' ' + l.padEnd(boxWidth - 4) + ' ' + borderColor(this.box.vertical)
        ).join('\n');

        return `\n${top}\n${middle}\n${bottom}\n`;
    },

    // Status indicators
    dot: {
        success: lime('◉'),
        error: rose('◉'),
        warning: amber('◉'),
        info: sky('◉'),
        neutral: slate('◉'),
    },

    // Box drawing — rounded corners
    box: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
        leftT: '├',
        rightT: '┤',
        cross: '┼',
    },

    // Heavy separator
    heavySep(label = '') {
        const termWidth = process.stdout.columns || 80;
        const { gutterStr, contentWidth } = this.layout;
        const availableWidth = termWidth - (gutterStr.length * 2);
        const width = Math.min(availableWidth, contentWidth);

        if (label) {
            const labelStr = ` ${label} `;
            const left = 3;
            const right = Math.max(0, width - left - labelStr.length);
            return gutterStr + zinc('━'.repeat(left)) + violet.bold(labelStr) + zinc('━'.repeat(right));
        }
        return gutterStr + zinc('━'.repeat(width));
    },

    // Light separator
    separator(label = '') {
        const termWidth = process.stdout.columns || 80;
        const { gutterStr, contentWidth } = this.layout;
        const availableWidth = termWidth - (gutterStr.length * 2);
        const width = Math.min(availableWidth, contentWidth);

        if (label) {
            const labelStr = ` ${label} `;
            const left = 2;
            const right = Math.max(0, width - left - labelStr.length);
            return gutterStr + zinc('╌'.repeat(left)) + cyan(labelStr) + zinc('╌'.repeat(right));
        }
        return gutterStr + zinc('╌'.repeat(width));
    },

    // Box around text
    boxed(text, width = 60) {
        const lines = text.split('\n');
        const maxLen = Math.min(width, Math.max(...lines.map(l => l.length)));
        const h = this.box.horizontal;
        const { gutterStr } = this.layout;

        const top = gutterStr + zinc(`${this.box.topLeft}${h.repeat(maxLen + 2)}${this.box.topRight}`);
        const bottom = gutterStr + zinc(`${this.box.bottomLeft}${h.repeat(maxLen + 2)}${this.box.bottomRight}`);
        const middle = lines.map(l =>
            gutterStr + zinc(this.box.vertical) + ' ' + l.padEnd(maxLen) + ' ' + zinc(this.box.vertical)
        ).join('\n');
        return `${top}\n${middle}\n${bottom}`;
    },

    // Token usage bar
    tokenBar(used, max) {
        const pct = Math.min(100, (used / max) * 100);
        const barWidth = 20;
        const filled = Math.round(barWidth * pct / 100);
        const empty = barWidth - filled;

        let barColor;
        if (pct < 50) barColor = lime;
        else if (pct < 75) barColor = amber;
        else barColor = rose;

        const bar = barColor('█'.repeat(filled)) + zinc('░'.repeat(empty));
        return `${bar} ${slate(`${pct.toFixed(0)}%`)}`;
    },

    // Format a cost/usage pill
    pill(label, value, color = slate) {
        return `${zinc('[')} ${color(label)} ${zinc('│')} ${dimWhite(value)} ${zinc(']')}`;
    },
};

export default theme;
