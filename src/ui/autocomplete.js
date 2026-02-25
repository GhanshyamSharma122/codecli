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
        this.drawnRows = 0;
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
            let isPasting = false;
            let pasteBuffer = '';
            this.selectedIndex = 0;
            this.drawnLines = 0;
            this.drawnRows = 0;
            this.lastDrawnRows = 1;


            process.stdin.resume();
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.setEncoding('utf8');

            const cleanup = () => {
                this._eraseDropdown(input, cursorPos);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
                process.stdin.removeListener('data', onKeypress);
                process.stdout.removeListener('resize', onResize);
            };

            const updateSuggestions = () => {
                this._eraseDropdown(input, cursorPos);
                if (input.startsWith('/') && input.length >= 1) {
                    suggestions = this._getSuggestions(input);
                    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, suggestions.length - 1));
                    if (suggestions.length > 0) {
                        this._drawDropdown(suggestions, input, cursorPos);
                    }
                } else {
                    suggestions = [];
                    this.selectedIndex = 0;
                }
            };

            const sanitizeText = (text) => {
                if (!text) return '';
                return text.replace(/\x1b\[[0-9;]*[mGJKH]/g, '');
            };

            const insertText = (text, { fromPaste = false } = {}) => {
                if (!text) return;
                const normalized = fromPaste
                    ? text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, ' ')
                    : text;
                input = input.slice(0, cursorPos) + normalized + input.slice(cursorPos);
                cursorPos += normalized.length;
                redrawLine();
                this.selectedIndex = 0;
                updateSuggestions();
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
                this.drawnLines = 0; // Dropdown is now cleared by \x1b[J
                this.drawnRows = 0;

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
                const PASTE_START = '\x1b[200~';
                const PASTE_END = '\x1b[201~';

                if (key && (isPasting || key.includes(PASTE_START))) {
                    let chunk = key;
                    if (!isPasting) {
                        const startIdx = chunk.indexOf(PASTE_START);
                        if (startIdx !== -1) {
                            isPasting = true;
                            chunk = chunk.slice(startIdx + PASTE_START.length);
                        }
                    }

                    if (isPasting) {
                        const endIdx = chunk.indexOf(PASTE_END);
                        if (endIdx !== -1) {
                            pasteBuffer += chunk.slice(0, endIdx);
                            isPasting = false;
                            const text = sanitizeText(pasteBuffer);
                            pasteBuffer = '';
                            insertText(text, { fromPaste: true });
                            const remaining = chunk.slice(endIdx + PASTE_END.length);
                            if (remaining) onKeypress(remaining);
                        } else {
                            pasteBuffer += chunk;
                        }
                        return;
                    }
                }

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

                // Handle non-bracketed paste chunks with newlines
                if (key && key.length > 1 && (key.includes('\n') || key.includes('\r'))) {
                    const text = sanitizeText(key);
                    insertText(text, { fromPaste: true });
                    return;
                }

                // Tab
                if (key === '\t') {
                    if (suggestions.length > 0) {
                        input = suggestions[this.selectedIndex].full + ' ';
                        cursorPos = input.length;
                        this._eraseDropdown(input, cursorPos);
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
                        this._eraseDropdown(input, cursorPos);
                        this._drawDropdown(suggestions, input, cursorPos);
                    }
                    return;
                }

                // Arrow Down
                if (key === '\x1b[B') {
                    if (suggestions.length > 0) {
                        this.selectedIndex = (this.selectedIndex + 1) % suggestions.length;
                        this._eraseDropdown(input, cursorPos);
                        this._drawDropdown(suggestions, input, cursorPos);
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
                    const plainKey = sanitizeText(key);
                    insertText(plainKey);
                }
            };

            const onResize = () => {
                redrawLine();
                if (suggestions.length > 0) {
                    this._eraseDropdown(input, cursorPos);
                    this._drawDropdown(suggestions, input, cursorPos);
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

    _calculateTotalRows(suggestions) {
        if (suggestions.length === 0) return 0;
        const cols = process.stdout.columns || 80;
        const gutterLen = this._getGutter().length;
        const maxNameLen = Math.max(...suggestions.map(s => s.name.length));

        let totalRows = 0;
        for (const s of suggestions) {
            // Line: gutter + " " + prefix(2) + namePart(maxNameLen + 1) + "  " + desc
            const lineLen = gutterLen + 1 + 2 + (maxNameLen + 1) + 2 + s.description.length;
            totalRows += Math.ceil(lineLen / cols) || 1;
        }
        return totalRows;
    }

    _drawDropdown(suggestions, input, cursorPos) {
        if (suggestions.length === 0) return;

        const gutter = this._getGutter();
        const cols = process.stdout.columns || 80;
        const visiblePromptLen = gutter.length + 2;
        const totalTextPos = visiblePromptLen + cursorPos;
        const visibleFullLen = visiblePromptLen + input.length;

        const targetRow = Math.floor(totalTextPos / cols);
        const lastRow = Math.floor((visibleFullLen - 1) / cols);
        const rowDiffToEnd = lastRow - targetRow;

        // 1. Move to the very end of the prompt text
        if (rowDiffToEnd > 0) {
            process.stdout.write(`\x1b[${rowDiffToEnd}B`);
        }

        const lastCol = (visibleFullLen % cols) || cols;
        process.stdout.write(`\r\x1b[${lastCol + 1}G`);

        // 2. Clear below and draw suggestions
        process.stdout.write('\n\x1b[J');

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
        this.drawnRows = this._calculateTotalRows(suggestions);

        // 3. Move back up exactly drawnRows + the extra \n we added + rowDiffToEnd
        const targetCol = (totalTextPos % cols) || cols;
        process.stdout.write(`\x1b[${this.drawnRows + rowDiffToEnd}A`);
        process.stdout.write(`\r\x1b[${targetCol + 1}G`);
    }

    _eraseDropdown(input = '', cursorPos = 0) {
        if (this.drawnRows === 0) return;

        const gutter = this._getGutter();
        const cols = process.stdout.columns || 80;
        const visiblePromptLen = gutter.length + 2;
        const totalTextPos = visiblePromptLen + cursorPos;
        const visibleFullLen = visiblePromptLen + input.length;

        const targetRow = Math.floor(totalTextPos / cols);
        const lastRow = Math.floor((visibleFullLen - 1) / cols);
        const rowDiffToEnd = lastRow - targetRow;

        // 1. Move to the very end of the prompt
        if (rowDiffToEnd > 0) {
            process.stdout.write(`\x1b[${rowDiffToEnd}B`);
        }
        const lastCol = (visibleFullLen % cols) || cols;
        process.stdout.write(`\r\x1b[${lastCol + 1}G`);

        // 2. Clear everything below prompt
        process.stdout.write('\n\x1b[J');

        // 3. Move back up to the line ABOVE the newline we just cleared
        process.stdout.write('\x1b[1A');

        // 4. Move up the rowDiff and restore target column
        if (rowDiffToEnd > 0) {
            process.stdout.write(`\x1b[${rowDiffToEnd}A`);
        }
        const targetCol = (totalTextPos % cols) || cols;
        process.stdout.write(`\r\x1b[${targetCol + 1}G`);

        this.drawnLines = 0;
        this.drawnRows = 0;
    }
}

export default AutocompleteInput;
