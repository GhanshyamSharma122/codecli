import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export default {
    name: 'file_search',
    description: 'Search for files by name or pattern in the project directory. Supports glob patterns.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Glob pattern to search for (e.g., "**/*.js", "*.py", "src/**/test*")',
            },
            directory: {
                type: 'string',
                description: 'Directory to search in (defaults to current working directory)',
            },
            maxResults: {
                type: 'integer',
                description: 'Maximum number of results to return (default: 50)',
            },
        },
        required: ['pattern'],
    },

    async execute({ pattern, directory, maxResults = 50 }, { cwd }) {
        const searchDir = directory ? path.resolve(cwd, directory) : cwd;

        try {
            const files = await glob(pattern, {
                cwd: searchDir,
                nodir: false,
                ignore: ['node_modules/**', '.git/**', '.codecli/**'],
                maxDepth: 10,
            });

            const results = files.slice(0, maxResults).map((f) => {
                const fullPath = path.join(searchDir, f);
                try {
                    const stat = fs.statSync(fullPath);
                    return {
                        path: f,
                        type: stat.isDirectory() ? 'directory' : 'file',
                        size: stat.isFile() ? stat.size : undefined,
                        modified: stat.mtime.toISOString(),
                    };
                } catch {
                    return { path: f, type: 'unknown' };
                }
            });

            return {
                matches: results,
                total: files.length,
                truncated: files.length > maxResults,
            };
        } catch (err) {
            return { error: `Search failed: ${err.message}` };
        }
    },
};
