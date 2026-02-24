import chalk from 'chalk';

export default {
    name: 'compact',
    description: 'Summarize conversation to reduce token usage',
    usage: '/compact',

    async execute(args, { session, context, providerManager }) {
        const messages = session.getMessages();
        if (messages.length < 6) {
            console.log(chalk.yellow('  Conversation is too short to compact.'));
            return;
        }

        console.log(chalk.cyan('  Compacting conversation...'));
        const before = messages.length;

        const compacted = await context.compactConversation(
            messages,
            providerManager.provider
        );

        session.clearMessages();
        for (const msg of compacted) {
            session.addMessage(msg.role, msg.content);
        }

        const after = session.messageCount;
        console.log(chalk.green(`  ✓ Compacted: ${before} → ${after} messages`));
        return { before, after };
    },
};
