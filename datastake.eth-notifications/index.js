const { Client } = require('discord.js');
const Request = require('request-promise');
const Cheerio = require('cheerio');
const Cron = require('cron').CronJob;
const Moment = require('moment');
const Bot = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });

const config = require('./config.json');

Bot.login(config.BOT_TOKEN);

Bot.on('ready', async () => {
  /* Weekly report message (every Mon 9AM)*/
  new Cron('0 9 * * 1', () => {
    const weeklyReport = await getWeeklyReportMessage();
    sendMessage(weeklyReport);
  }, null, true);
});

Bot.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.BOT_PREFIX)) return;

  const commandBody = message.content.slice(config.BOT_PREFIX.length);
  const args = commandBody.split(' ')[1];
  switch (args) {
    case 'balance':
      await sendMessage(await getWeeklyReportMessage());
      break;
    default:
      await sendMessage('No command specified');
      break;
  }
});

const parseCurrency = (price) => parseFloat(price.split('(')[0].trim().split('$')[1].split(',').join(''));
const formatCurrency = (num) => (num).toLocaleString({ style: 'decimal', currency: 'USD', minimumFractionDigits: 2 });

const getWallet = async () => {
  const html = await Request(config.WALLET_ADDR);
  const $ = Cheerio.load(html);
  const content = $('h2:contains("Overview")')
    .parent()
    .parent()
    .parent()
    .children()
    .find('.card-body')
    .text();
  const parsed = content
    .replace(/\n/g, '')
    .replace(/\dCould not find any matches.+/g, "");
  const balance = parsed
    .split(/EtherValue:.+/)[0]
    .replace(/:/, ': ')
    .replace(/Balance:/, '');
  const etherValue = `Ether${parsed.split(/Token:.+/)[0].split(/Ether/)[2]}`
    .replace(/:/, ': ')
    .replace(/EtherValue:/, '');
  const tokenValue = parsed
    .match(/Token:.+/)[0]
    .replace(/:/, ': ')
    .replace(/Token:/, '');

  return {
    balance: parseFloat(balance.split('Ether')[0].trim()),
    etherValue: parseCurrency(etherValue),
    tokenValue: parseCurrency(tokenValue),
  }
}

const getWeeklyReportMessage = async () => {
  const { etherValue, tokenValue } = await getWallet();
  return `** Datastake Crypto Wallet Update ** \n:flag_gb: Once everything is in place, Datastake will reward its largest information holders thanks to crypto donations. Below is the available balance of funds as of today.\n:flag_fr: Quand tout sera en place, Datastake récompensera les plus gros détenteurs d'information grâce aux dons en crypto-monnaies. Ci-dessous le solde disponible à ce jour.\n-----------------------------\nDate: ${Moment().format('DD/MM/YY')}\nETH: $${formatCurrency(etherValue)}\nToken: $${formatCurrency(tokenValue)}\nTotal: $${formatCurrency(etherValue + tokenValue)}`;
}

const sendMessage = async (message) => {
  if (!message) return;

  try {
    const guildIds = Array.from((await Bot.guilds.fetch()).values()).map(g => g.id);
    for (const guildId of guildIds) {
      const guild = await Bot.guilds.cache.get(guildId);
      const channels = await guild.channels.fetch();
      const hasBotChannel = Array.from(channels.values())
        .find(ch => ch.name === config.CHANNEL_NAME);
      if (hasBotChannel) {
        const channel = await channels.get(hasBotChannel.id);
        await channel.send(message);
      }
    }
  } catch (e) {
    console.log('Error occured', e);
  }
}

