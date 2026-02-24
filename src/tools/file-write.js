import fs from 'fs';
import path from 'path';
import { displayDiff } from '../utils/diff.js';
import chalk from 'chalk';

export default {
    name: 'write_file',
    description: 'Write or edit a file. Shows a diff preview before making changes. Can create new files or edit existing ones. For editing, you can replace specific content or write the entire file.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file to write or create',
            },
            content: {
                type: 'string',
                description: 'Full content to write to the file',
            },
            mode: {
                type: 'string',
                enum: ['write', 'append', 'insert'],
                description: 'Write mode: "write" (overwrite), "append" (add to end), "insert" (insert at line)',
            },
            insertLine: {
                type: 'integer',
                description: 'Line number to insert at (only used with mode "insert")',
            },
            searchReplace: {
                type: 'object',
                description: 'Search and replace operation. Use this for targeted edits.',
                properties: {
                    search: { type: 'string', description: 'Text to search for' },
                    replace: { type: 'string', description: 'Text to replace with' },
                },
            },
        },
        required: ['path', 'content'],
    },

    async execute({ path: filePath, content, mode = 'write', insertLine, searchReplace }, { permissions, cwd }) {
        const resolved = path.resolve(cwd, filePath);
        const dir = path.dirname(resolved);

        const allowed = await permissions.checkWrite(resolved);
        if (!allowed) return { error: 'Permission denied' };

        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const exists = fs.existsSync(resolved);
        const oldContent = exists ? fs.readFileSync(resolved, 'utf-8') : '';
        let newContent;

        if (searchReplace) {
            if (!exists) return { error: 'Cannot search/replace in non-existent file' };
            if (!oldContent.includes(searchReplace.search)) {
                return { error: `Search text not found in file: "${searchReplace.search.substring(0, 50)}..."` };
            }
            newContent = oldContent.replace(searchReplace.search, searchReplace.replace);
        } else if (mode === 'append') {
            newContent = oldContent + content;
        } else if (mode === 'insert' && insertLine) {
            const lines = oldContent.split('\n');
            lines.splice(insertLine - 1, 0, content);
            newContent = lines.join('\n');
        } else {
            newContent = content;
        }

        // Show diff for existing files
        if (exists && oldContent !== newContent) {
            displayDiff(oldContent, newContent, path.basename(resolved));
        }

        try {
            fs.writeFileSync(resolved, newContent);
            const lines = newContent.split('\n').length;
            console.log(chalk.green(`  ✓ ${exists ? 'Updated' : 'Created'} ${filePath} (${lines} lines)`));
            return {
                success: true,
                action: exists ? 'updated' : 'created',
                path: resolved,
                lines,
            };
        } catch (err) {
            return { error: `Failed to write file: ${err.message}` };
        }
    },
};
