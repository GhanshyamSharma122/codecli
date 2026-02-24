import { spawn } from 'child_process';
import chalk from 'chalk';

export default {
    name: 'run_command',
    description: 'Execute a shell command and return its output. Use this for running tests, builds, git operations, and other shell tasks.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute',
            },
            cwd: {
                type: 'string',
                description: 'Working directory for the command (defaults to project root)',
            },
            timeout: {
                type: 'integer',
                description: 'Timeout in milliseconds (default: 30000)',
            },
        },
        required: ['command'],
    },

    async execute({ command, cwd: execCwd, timeout = 30000 }, { permissions, cwd }) {
        const workDir = execCwd || cwd;

        const allowed = await permissions.checkExecute(command);
        if (!allowed) return { error: 'Permission denied' };

        console.log(chalk.dim(`  $ ${command}`));

        return new Promise((resolve) => {
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd.exe' : '/bin/sh';
            const shellFlag = isWindows ? '/c' : '-c';

            const proc = spawn(shell, [shellFlag, command], {
                cwd: workDir,
                env: { ...process.env, FORCE_COLOR: '0' },
                timeout,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                process.stdout.write(chalk.dim(text));
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                process.stderr.write(chalk.yellow(text));
            });

            proc.on('close', (code) => {
                console.log('');
                resolve({
                    exitCode: code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    success: code === 0,
                });
            });

            proc.on('error', (err) => {
                resolve({
                    exitCode: -1,
                    stdout: '',
                    stderr: err.message,
                    success: false,
                    error: err.message,
                });
            });
        });
    },
};
