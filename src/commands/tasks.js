import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import theme from '../ui/theme.js';

export default {
    name: 'tasks',
    description: 'Manage persistent task list',
    usage: '/tasks [add|done|remove|clear] [task text]',

    async execute(args, { config }) {
        const tasksFile = path.join(config.globalConfigDir, 'tasks', 'tasks.json');

        let tasks = [];
        if (fs.existsSync(tasksFile)) {
            try { tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8')); } catch { tasks = []; }
        }

        const action = args[0] || 'list';
        const text = args.slice(1).join(' ');

        switch (action) {
            case 'add':
                if (!text) { console.log(chalk.yellow('  Usage: /tasks add <task description>')); return; }
                tasks.push({ id: Date.now(), text, done: false, created: new Date().toISOString() });
                saveTasks(tasksFile, tasks);
                console.log(chalk.green(`  ✓ Added task: ${text}`));
                break;

            case 'done':
                const doneIndex = parseInt(text) - 1;
                if (isNaN(doneIndex) || doneIndex < 0 || doneIndex >= tasks.length) {
                    console.log(chalk.yellow('  Usage: /tasks done <number>'));
                    return;
                }
                tasks[doneIndex].done = true;
                saveTasks(tasksFile, tasks);
                console.log(chalk.green(`  ✓ Completed: ${tasks[doneIndex].text}`));
                break;

            case 'remove':
                const rmIndex = parseInt(text) - 1;
                if (isNaN(rmIndex) || rmIndex < 0 || rmIndex >= tasks.length) {
                    console.log(chalk.yellow('  Usage: /tasks remove <number>'));
                    return;
                }
                const removed = tasks.splice(rmIndex, 1);
                saveTasks(tasksFile, tasks);
                console.log(chalk.green(`  ✓ Removed: ${removed[0].text}`));
                break;

            case 'clear':
                tasks = [];
                saveTasks(tasksFile, tasks);
                console.log(chalk.green('  ✓ All tasks cleared'));
                break;

            case 'list':
            default:
                if (tasks.length === 0) {
                    console.log(chalk.dim('  No tasks. Use /tasks add <description> to create one.'));
                    return;
                }
                console.log('');
                console.log(theme.header('  Task List'));
                console.log('');
                tasks.forEach((task, i) => {
                    const check = task.done ? chalk.green('✓') : chalk.dim('○');
                    const text = task.done ? chalk.dim.strikethrough(task.text) : chalk.white(task.text);
                    console.log(`  ${chalk.dim(`${i + 1}.`)} ${check} ${text}`);
                });
                console.log('');
                break;
        }
    },
};

function saveTasks(file, tasks) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2));
}
