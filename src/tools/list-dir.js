import fs from 'fs';
import path from 'path';

export default {
    name: 'list_directory',
    description: 'List the contents of a directory with file types, sizes, and basic info.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the directory to list (defaults to cwd)',
            },
            recursive: {
                type: 'boolean',
                description: 'Whether to list recursively (default: false, max depth 3)',
            },
            showHidden: {
                type: 'boolean',
                description: 'Whether to show hidden files (default: false)',
            },
        },
        required: [],
    },

    async execute({ path: dirPath, recursive = false, showHidden = false }, { cwd }) {
        const resolved = path.resolve(cwd, dirPath || '.');

        if (!fs.existsSync(resolved)) {
            return { error: `Directory not found: ${resolved}` };
        }

        if (!fs.statSync(resolved).isDirectory()) {
            return { error: `Not a directory: ${resolved}` };
        }

        try {
            const entries = listDir(resolved, { recursive, showHidden, maxDepth: 3 });
            return {
                directory: resolved,
                entries,
                total: entries.length,
            };
        } catch (err) {
            return { error: `Failed to list directory: ${err.message}` };
        }
    },
};

function listDir(dir, options, depth = 0) {
    const results = [];
    const ignoreList = ['node_modules', '.git', '__pycache__', '.codecli'];

    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }

    for (const entry of entries) {
        if (!options.showHidden && entry.name.startsWith('.')) continue;
        if (ignoreList.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = entry.name;

        if (entry.isDirectory()) {
            const children = options.recursive && depth < options.maxDepth
                ? listDir(fullPath, options, depth + 1)
                : undefined;

            results.push({
                name: relativePath,
                type: 'directory',
                children: children?.length || undefined,
            });

            if (children) {
                for (const child of children) {
                    results.push({
                        ...child,
                        name: path.join(relativePath, child.name),
                    });
                }
            }
        } else if (entry.isFile()) {
            try {
                const stat = fs.statSync(fullPath);
                results.push({
                    name: relativePath,
                    type: 'file',
                    size: formatSize(stat.size),
                    modified: stat.mtime.toISOString().split('T')[0],
                });
            } catch {
                results.push({ name: relativePath, type: 'file' });
            }
        }
    }

    return results;
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
