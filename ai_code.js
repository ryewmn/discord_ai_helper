require('dotenv/config');
const { Client, IntentsBitField } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');


const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.DirectMessages
    ],
});


client.on('ready', async () => {
    console.log('The bot is online!');
    // Create a slash command
    const data = {
        name: 'chat',
        description: 'Start a chat with the bot',
    };
    // Register the slash command
    const guildId = process.env.GUILD_ID;
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.create(data);
})
const configuration = new Configuration({
    apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'chat') {
        const thread = await interaction.channel.threads.create({
            name: `Chat started by ${interaction.user.username}`,
            autoArchiveDuration: 60,
        });

        interaction.reply(`New chat thread created: ${thread.name}`);

        const messageCollectorFilter = (m) => !m.author.bot && m.author.id === interaction.user.id;
        const messageCollector = thread.createMessageCollector({ filter: messageCollectorFilter, time: 600000 }); // Collect messages for 10 minutes (600000 ms)

        messageCollector.on('collect', async (message) => {
            const chatResponse = await getChatResponse(thread, message.content, message.author.id);
            await thread.send(chatResponse);
        });

        messageCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                thread.send('Thread timed out and is now being deleted.');
                thread.delete(); // Delete the thread
            }
        });
    }
});


client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.thread) return;

    const chatResponse = await getChatResponse(message.channel, message.content, message.author.id);
    await message.reply(chatResponse);
});

async function getChatResponse(channel, userMessage, authorId) {
    let conversationLog = [{ role: 'system', content: 'You are a friendly chatbot.' }];

    try {
        await channel.sendTyping();

        let prevMessages = await channel.messages.fetch({ limit: 15 });
        prevMessages.reverse();

        prevMessages.forEach((msg) => {
            if (msg.author.id !== client.user.id && msg.author.bot) return;
            if (msg.author.id !== authorId) return;

            conversationLog.push({
                role: 'user',
                content: msg.content,
            });
        });

        const result = await openai
            .createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages: conversationLog,
                // max_tokens: 256, // limit token usage
            })
            .catch((error) => {
                console.log(`OPENAI ERR: ${error}`);
            });

        return result.data.choices[0].message;
    } catch (error) {
        console.log(`ERR: ${error}`);
        return "Error: Unable to process your message";
    }
}

client.login(process.env.TOKEN);

