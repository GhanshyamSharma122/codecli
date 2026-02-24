import chalk from 'chalk';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
    constructor(level = 'info') {
        this.level = LOG_LEVELS[level] ?? 1;
    }

    debug(...args) {
        if (this.level <= LOG_LEVELS.debug) {
            console.log(chalk.dim('[DEBUG]'), ...args);
        }
    }

    info(...args) {
        if (this.level <= LOG_LEVELS.info) {
            console.log(chalk.blue('[INFO]'), ...args);
        }
    }

    warn(...args) {
        if (this.level <= LOG_LEVELS.warn) {
            console.log(chalk.yellow('[WARN]'), ...args);
        }
    }

    error(...args) {
        if (this.level <= LOG_LEVELS.error) {
            console.log(chalk.red('[ERROR]'), ...args);
        }
    }

    success(...args) {
        console.log(chalk.green('✓'), ...args);
    }

    tool(name, ...args) {
        console.log(chalk.magenta(`⚡ [${name}]`), ...args);
    }
}

export default new Logger(process.env.LOG_LEVEL || 'warn');
