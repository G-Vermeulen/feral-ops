import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { runChat } from './chat.js';

// Per-channel conversation history, kept in memory only (resets on restart/deploy).
const historyByChannel = new Map();
const MAX_HISTORY_MESSAGES = 20;

export function startDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log('DISCORD_BOT_TOKEN not set — Discord bot not starting.');
    return;
  }

  const targetChannelId = process.env.DISCORD_CHANNEL_ID || null;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once('ready', () => {
    console.log(`Discord Questmaster online as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const mentioned = client.user && message.mentions.has(client.user);
    const inTargetChannel = targetChannelId ? message.channel.id === targetChannelId : false;

    // If a specific channel is configured, respond to everything there.
    // Otherwise, only respond when actually @mentioned.
    if (targetChannelId ? !inTargetChannel : !mentioned) return;

    const content = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return;

    await message.channel.sendTyping();

    try {
      const history = historyByChannel.get(message.channel.id) || [];
      const { reply, messages } = await runChat(content, history);

      historyByChannel.set(message.channel.id, messages.slice(-MAX_HISTORY_MESSAGES));

      // Discord caps messages at 2000 characters
      const text = reply || "The Questmaster has nothing to report.";
      await message.reply(text.length > 1900 ? text.slice(0, 1900) + '…' : text);
    } catch (err) {
      console.error('Discord chat failed:', err);
      await message.reply("Something went wrong reaching the Questmaster's ledger — try again shortly.");
    }
  });

  client.login(token).catch((err) => {
    console.error('Discord bot failed to log in:', err.message);
  });
}
