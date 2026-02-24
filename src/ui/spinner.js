import ora from 'ora';
import chalk from 'chalk';
import theme from './theme.js';

const THINKING_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const TOOL_FRAMES = ['◐', '◓', '◑', '◒'];
const SPARKLE_FRAMES = ['✦', '✧', '✦', '✧'];

class Spinner {
    constructor() {
        this.spinner = null;
        this.startTime = null;
        this.elapsed = null;
        this.elapsedInterval = null;
    }

    start(text = 'Thinking...', type = 'thinking') {
        this.stop();
        this.startTime = Date.now();

        const frames = type === 'tool' ? TOOL_FRAMES : type === 'sparkle' ? SPARKLE_FRAMES : THINKING_FRAMES;
        const { gutterStr } = theme.layout;

        this.spinner = ora({
            text: chalk.hex('#A78BFA')(text),
            spinner: { interval: 80, frames },
            color: 'magenta',
            prefixText: gutterStr,
        }).start();

        // Live elapsed timer
        this.elapsedInterval = setInterval(() => {
            if (this.spinner) {
                const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
                this.spinner.text = chalk.hex('#A78BFA')(text) + chalk.hex('#475569')(` (${elapsed}s)`);
            }
        }, 100);
    }

    update(text) {
        if (this.spinner) {
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
            this.spinner.text = chalk.hex('#22D3EE')(text) + chalk.hex('#475569')(` (${elapsed}s)`);
        }
    }

    succeed(text) {
        this._clearInterval();
        if (this.spinner) {
            const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
            this.spinner.succeed(
                chalk.hex('#A3E635')(text || 'Done') + chalk.hex('#475569')(` (${duration}s)`)
            );
            this.spinner = null;
        }
    }

    fail(text) {
        this._clearInterval();
        if (this.spinner) {
            this.spinner.fail(chalk.hex('#FB7185')(text || 'Failed'));
            this.spinner = null;
        }
    }

    stop() {
        this._clearInterval();
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }

    thinking() {
        this.start('Thinking...', 'thinking');
    }

    tooling(name) {
        this.start(`Running ${name}...`, 'tool');
    }

    _clearInterval() {
        if (this.elapsedInterval) {
            clearInterval(this.elapsedInterval);
            this.elapsedInterval = null;
        }
    }
}

export default Spinner;
