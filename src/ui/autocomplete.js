import chalk from 'chalk';
import theme from './theme.js';

/**
 * AutocompleteInput — custom raw-mode input with live suggestion dropdown.
 * Supports multi-line wrapping and horizontal cursor navigation.
 */
class AutocompleteInput {
    constructor(commands) {
        this.commands = commands;
        this.selectedIndex = 0;
        this.maxVisible = 8;
        this.drawnLines = 0;
        this.lastDrawnRows = 1;
    }

    _getGutter() {
        return theme.layout.gutterStr;
    }

    ask(promptPrefix) {
        return new Promise((resolve) => {
            let input = '';
            let cursorPos = 0;
            let suggestions = [];
            this.selectedIndex = 0;
            this.drawnLines = 0;
            this.lastDrawnRows = 1;

            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            const cleanup = () => {
                this._eraseDropdown();
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.removeListener('data', onKeypress);
                process.stdout.removeListener('resize', onResize);
            };

            const updateSuggestions = () => {
                this._eraseDropdown();
                if (input.startsWith('/') && input.length >= 1) {
                    suggestions = this._getSuggestions(input);
                    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, suggestions.length - 1));
                    if (suggestions.length > 0) {
                        this._drawDropdown(suggestions);
                    }
                } else {
                    suggestions = [];
                    this.selectedIndex = 0;
                }
            };

            const redrawLine = () => {
                const gutter = this._getGutter();
                const promptIndicator = chalk.hex('#A78BFA').bold(theme.symbols.arrow);
                const promptLine = `${gutter}${promptIndicator} `;

                const visibleGutterLen = gutter.length;
                const visiblePromptLen = visibleGutterLen + 2; // gutter + "❯ "
                const visibleFullLen = visiblePromptLen + input.length;
                const cols = process.stdout.columns || 80;

                // Move cursor to start of current input block
                if (this.lastDrawnRows > 1) {
                    process.stdout.write(`\x1b[${this.lastDrawnRows - 1}A`);
                }
                process.stdout.write('\r\x1b[J'); // Reset to start and clear everything below

                process.stdout.write(promptLine + input);

                // Calculate where the cursor SHOULD be based on visible lengths
                const totalTextPos = visiblePromptLen + cursorPos;
                const targetRow = Math.floor(totalTextPos / cols);
                const targetCol = totalTextPos % cols;
                const totalRows = Math.ceil(visibleFullLen / cols) || 1;

                this.lastDrawnRows = totalRows;

                // Move cursor to the actual cursorPos
                const endRow = Math.floor((visibleFullLen - 1) / cols);
                const rowDiff = endRow - targetRow;

                if (rowDiff > 0) {
                    process.stdout.write(`\x1b[${rowDiff}A`);
                }
                process.stdout.write(`\r\x1b[${targetCol + 1}G`);
            };

            const onKeypress = (key) => {
                // Ctrl+C
                if (key === '\x03') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve('');
                    return;
                }

                // Ctrl+D
                if (key === '\x04') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve('/exit');
                    return;
                }

                // Enter
                if (key === '\r' || key === '\n') {
                    if (suggestions.length > 0 && input.startsWith('/')) {
                        input = suggestions[this.selectedIndex].full;
                        cursorPos = input.length;
                    }
                    cleanup();

                    // Move to end of wrapped input before printing newline
                    const gutter = this._getGutter();
                    const visiblePromptLen = gutter.length + 2;
                    const visibleFullLen = visiblePromptLen + input.length;
                    const cols = process.stdout.columns || 80;
                    const totalRows = Math.ceil(visibleFullLen / cols) || 1;
                    const targetRow = Math.floor((visiblePromptLen + cursorPos) / cols);
                    const rowDiff = (totalRows - 1) - targetRow;
                    if (rowDiff > 0) process.stdout.write(`\x1b[${rowDiff}B`);

                    process.stdout.write('\n');
                    resolve(input);
                    return;
                }

                // Tab
                if (key === '\t') {
                    if (suggestions.length > 0) {
                        input = suggestions[this.selectedIndex].full + ' ';
                        cursorPos = input.length;
                        this._eraseDropdown();
                        suggestions = [];
                        redrawLine();
                    }
                    return;
                }

                // Backspace
                if (key === '\x7f' || key === '\b') {
                    if (cursorPos > 0) {
                        input = input.slice(0, cursorPos - 1) + input.slice(cursorPos);
                        cursorPos--;
                        redrawLine();
                        updateSuggestions();
                    }
                    return;
                }

                // Arrow Up
                if (key === '\x1b[A') {
                    if (suggestions.length > 0) {
                        this.selectedIndex = (this.selectedIndex - 1 + suggestions.length) % suggestions.length;
                        this._eraseDropdown();
                        this._drawDropdown(suggestions);
                    }
                    return;
                }

                // Arrow Down
                if (key === '\x1b[B') {
                    if (suggestions.length > 0) {
                        this.selectedIndex = (this.selectedIndex + 1) % suggestions.length;
                        this._eraseDropdown();
                        this._drawDropdown(suggestions);
                    }
                    return;
                }

                // Arrow Right
                if (key === '\x1b[C') {
                    if (cursorPos < input.length) {
                        cursorPos++;
                        redrawLine();
                    }
                    return;
                }

                // Arrow Left
                if (key === '\x1b[D') {
                    if (cursorPos > 0) {
                        cursorPos--;
                        redrawLine();
                    }
                    return;
                }

                // Regular character or pasted text
                if (key >= ' ' && !key.startsWith('\x1b')) {
                    // Filter out ANSI escape codes from pasted text
                    const plainKey = key.replace(/\x1b\[[0-9;]*[mGJKH]/g, '');
                    input = input.slice(0, cursorPos) + plainKey + input.slice(cursorPos);
                    cursorPos += plainKey.length;
                    redrawLine();
                    this.selectedIndex = 0;
                    updateSuggestions();
                }
            };

            const onResize = () => {
                redrawLine();
                if (suggestions.length > 0) {
                    this._eraseDropdown();
                    this._drawDropdown(suggestions);
                }
            };

            process.stdout.on('resize', onResize);
            process.stdin.on('data', onKeypress);
            redrawLine(); // Initial draw
        });
    }

    _getSuggestions(input) {
        const partial = input.toLowerCase();
        return this.commands
            .filter(c => `/${c.name}`.startsWith(partial))
            .slice(0, this.maxVisible)
            .map(c => ({
                name: c.name,
                description: c.description || '',
                full: `/${c.name}`,
            }));
    }

    _drawDropdown(suggestions) {
        if (suggestions.length === 0) return;

        const gutter = this._getGutter();
        process.stdout.write('\n');
        const maxNameLen = Math.max(...suggestions.map(s => s.name.length));

        for (let i = 0; i < suggestions.length; i++) {
            const s = suggestions[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? chalk.hex('#A78BFA')(theme.symbols.arrow + ' ') : '  ';
            const name = isSelected
                ? chalk.hex('#A78BFA').bold(`/${s.name.padEnd(maxNameLen)}`)
                : chalk.hex('#94A3B8')(`/${s.name.padEnd(maxNameLen)}`);
            const desc = isSelected
                ? chalk.hex('#CBD5E1')(s.description)
                : chalk.hex('#64748B')(s.description);

            process.stdout.write(`${gutter} ${prefix}${name}  ${desc}`);
            if (i < suggestions.length - 1) process.stdout.write('\n');
        }

        this.drawnLines = suggestions.length;
        process.stdout.write(`\x1b[${this.drawnLines}A`);
    }

    _eraseDropdown() {
        if (this.drawnLines === 0) return;
        process.stdout.write('\n');
        for (let i = 0; i < this.drawnLines; i++) {
            process.stdout.write('\x1b[K');
            if (i < this.drawnLines - 1) process.stdout.write('\n');
        }
        process.stdout.write(`\x1b[${this.drawnLines}A`);
        this.drawnLines = 0;
    }
}

export default AutocompleteInput;
