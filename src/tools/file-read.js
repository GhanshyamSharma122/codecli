import fs from 'fs';
import path from 'path';

export default {
    name: 'read_file',
    description: 'Read the contents of a file. Can optionally read specific line ranges.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Absolute or relative path to the file to read',
            },
            startLine: {
                type: 'integer',
                description: 'Optional start line number (1-indexed)',
            },
            endLine: {
                type: 'integer',
                description: 'Optional end line number (1-indexed, inclusive)',
            },
        },
        required: ['path'],
    },

    async execute({ path: filePath, startLine, endLine }, { permissions, cwd }) {
        const resolved = path.resolve(cwd, filePath);

        if (!fs.existsSync(resolved)) {
            return { error: `File not found: ${resolved}` };
        }

        const allowed = await permissions.checkRead(resolved);
        if (!allowed) return { error: 'Permission denied' };

        try {
            const content = fs.readFileSync(resolved, 'utf-8');

            if (startLine || endLine) {
                const lines = content.split('\n');
                const start = (startLine || 1) - 1;
                const end = endLine || lines.length;
                const slice = lines.slice(start, end);
                return {
                    content: slice.map((line, i) => `${start + i + 1} | ${line}`).join('\n'),
                    totalLines: lines.length,
                    range: { start: start + 1, end: Math.min(end, lines.length) },
                };
            }

            const lines = content.split('\n');
            return {
                content: lines.length > 500
                    ? lines.slice(0, 500).map((l, i) => `${i + 1} | ${l}`).join('\n') + `\n... (${lines.length - 500} more lines)`
                    : content,
                totalLines: lines.length,
            };
        } catch (err) {
            return { error: `Failed to read file: ${err.message}` };
        }
    },
};
