import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export default {
    name: 'code_search',
    description: 'Search for text or regex patterns in code files. Similar to grep/ripgrep. Returns matching lines with file paths and line numbers.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Text or regex pattern to search for',
            },
            directory: {
                type: 'string',
                description: 'Directory to search in (defaults to cwd)',
            },
            include: {
                type: 'string',
                description: 'File pattern to include (e.g., "*.js", "*.py")',
            },
            isRegex: {
                type: 'boolean',
                description: 'Whether the query is a regex pattern',
            },
            caseSensitive: {
                type: 'boolean',
                description: 'Whether the search is case-sensitive (default: false)',
            },
            maxResults: {
                type: 'integer',
                description: 'Maximum number of results (default: 50)',
            },
        },
        required: ['query'],
    },

    async execute({ query, directory, include, isRegex = false, caseSensitive = false, maxResults = 50 }, { cwd }) {
        const searchDir = directory ? path.resolve(cwd, directory) : cwd;

        // Try using native grep/findstr, fall back to JS implementation
        try {
            return nativeSearch(query, searchDir, { include, isRegex, caseSensitive, maxResults });
        } catch {
            return jsSearch(query, searchDir, { include, isRegex, caseSensitive, maxResults });
        }
    },
};

function nativeSearch(query, searchDir, options) {
    const isWindows = process.platform === 'win32';
    let cmd;

    if (isWindows) {
        const flags = options.caseSensitive ? '' : '/I';
        cmd = `findstr /S /N ${flags} "${query.replace(/"/g, '\\"')}" "${searchDir}\\*"`;
        if (options.include) {
            cmd = `findstr /S /N ${flags} "${query.replace(/"/g, '\\"')}" "${searchDir}\\${options.include}"`;
        }
    } else {
        const flags = ['-rn', '--color=never'];
        if (!options.caseSensitive) flags.push('-i');
        if (options.isRegex) flags.push('-E');
        if (options.include) flags.push(`--include="${options.include}"`);
        flags.push('--exclude-dir=node_modules', '--exclude-dir=.git');
        cmd = `grep ${flags.join(' ')} "${query}" "${searchDir}"`;
    }

    try {
        const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 10000 });
        const lines = output.split('\n').filter(Boolean).slice(0, options.maxResults);

        const results = lines.map((line) => {
            const match = line.match(/^(.+?)[:\s]+(\d+)[:\s]+(.*)$/);
            if (match) {
                return {
                    file: path.relative(searchDir, match[1]),
                    line: parseInt(match[2]),
                    content: match[3].trim(),
                };
            }
            return { raw: line };
        });

        return { matches: results, total: lines.length };
    } catch (e) {
        if (e.status === 1) return { matches: [], total: 0 };
        throw e;
    }
}

function jsSearch(query, searchDir, options) {
    const results = [];
    const regex = options.isRegex
        ? new RegExp(query, options.caseSensitive ? 'g' : 'gi')
        : new RegExp(escapeRegex(query), options.caseSensitive ? 'g' : 'gi');

    const includePattern = options.include
        ? new RegExp(options.include.replace(/\*/g, '.*').replace(/\?/g, '.'))
        : null;

    function searchDir2(dir, depth = 0) {
        if (depth > 8 || results.length >= options.maxResults) return;

        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

        for (const entry of entries) {
            if (results.length >= options.maxResults) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                searchDir2(fullPath, depth + 1);
            } else if (entry.isFile()) {
                if (includePattern && !includePattern.test(entry.name)) continue;

                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length && results.length < options.maxResults; i++) {
                        if (regex.test(lines[i])) {
                            results.push({
                                file: path.relative(searchDir, fullPath),
                                line: i + 1,
                                content: lines[i].trim(),
                            });
                        }
                        regex.lastIndex = 0;
                    }
                } catch {
                    // Skip binary or unreadable files
                }
            }
        }
    }

    searchDir2(searchDir);
    return { matches: results, total: results.length };
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
