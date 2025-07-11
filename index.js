require('dotenv').config({ path: 'env' });
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  SlashCommandBuilder, 
  REST, 
  Routes 
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

// Registrar comandos al iniciar
const commands = [
  new SlashCommandBuilder()
    .setName('fichaje')
    .setDescription('Proponer un fichaje')
    .addUserOption(o => o.setName('jugador').setDescription('Jugador').setRequired(true))
    .addRoleOption(o => o.setName('equipo').setDescription('Equipo').setRequired(true))
    .addIntegerOption(o => o.setName('precio').setDescription('Precio').setRequired(true))
    .addStringOption(o => o.setName('estadia').setDescription('Estadía').setRequired(false))
    .addStringOption(o => o.setName('clausula').setDescription('Cláusula').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mi-baja')
    .setDescription('Darse de baja de un equipo')
    .addRoleOption(o => o.setName('equipo').setDescription('Equipo').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(true)),

  new SlashCommandBuilder()
    .setName('bajar')
    .setDescription('Dar de baja a un jugador')
    .addUserOption(o => o.setName('jugador').setDescription('Jugador').setRequired(true))
    .addRoleOption(o => o.setName('equipo').setDescription('Equipo').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(true)),

  new SlashCommandBuilder()
    .setName('comprar')
    .setDescription('Comprar cláusula de un jugador')
    .addUserOption(o => o.setName('jugador').setDescription('Jugador').setRequired(true))
    .addIntegerOption(o => o.setName('clausula').setDescription('Valor de cláusula').setRequired(true))
    .addRoleOption(o => o.setName('equipo_nuevo').setDescription('Equipo nuevo').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando comandos...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandos registrados.');
  } catch (err) {
    console.error(err);
  }
})();

// Interacción
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, member, guild } = interaction;

  // /fichaje
  if (commandName === 'fichaje') {
    const jugador = options.getUser('jugador');
    const equipo = options.getRole('equipo');
    const precio = options.getInteger('precio');
    const estadia = options.getString('estadia') ?? 'No especificada';
    const clausula = options.getString('clausula') ?? 'No';

    const embed = new EmbedBuilder()
      .setTitle(`Nuevo Fichaje`)
      .setColor('Yellow')
      .addFields(
        { name: 'Jugador', value: `${jugador}` },
        { name: 'Equipo', value: `${equipo}` },
        { name: 'Precio', value: `💰 $${precio}` },
        { name: 'Estadía', value: estadia },
        { name: 'Cláusula', value: clausula },
        { name: 'Estado', value: '⏳ **Esperando decisión...**' }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('aceptar_fichaje')
        .setLabel('✅ Aceptar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('rechazar_fichaje')
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await interaction.reply({
      content: `${interaction.user} quiere fichar a ${jugador} para el ${equipo.name}`,
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.user.id !== jugador.id) {
        return i.reply({ content: 'Solo el jugador puede aceptar o rechazar.', ephemeral: true });
      }

      if (i.customId === 'aceptar_fichaje') {
        embed.spliceFields(5, 1, { name: 'Estado', value: '✅ **Aceptado**' });
        await i.update({ content: `${jugador} aceptó la propuesta de fichaje del ${equipo.name}`, embeds: [embed], components: [] });
        const member = await guild.members.fetch(jugador.id);
        await member.roles.add(equipo.id);
      }

      if (i.customId === 'rechazar_fichaje') {
        embed.spliceFields(5, 1, { name: 'Estado', value: '❌ **Rechazado**' });
        await i.update({ content: `${jugador} no quiso ir al ${equipo.name}`, embeds: [embed], components: [] });
      }
    });
  }

  // /mi-baja
  if (commandName === 'mi-baja') {
    const equipo = options.getRole('equipo');
    const razon = options.getString('razon');

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user} se ha dado de baja del ${equipo.name} 😪`)
      .setColor('Red')
      .addFields(
        { name: 'Jugador', value: `${interaction.user}` },
        { name: 'Equipo', value: `${equipo}` },
        { name: 'Razón', value: razon }
      )
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed] });
    await member.roles.remove(equipo.id);
  }

  // /bajar
  if (commandName === 'bajar') {
    const jugador = options.getUser('jugador');
    const equipo = options.getRole('equipo');
    const razon = options.getString('razon');
    const hasPerm = member.roles.cache.has('1392677935156301903') || member.roles.cache.has('1392677935156301902');

    if (!hasPerm) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user} ha dado de baja a ${jugador} del equipo, por ello ahora es **Agente Libre**`)
      .setColor('Red')
      .addFields(
        { name: 'Equipo', value: `${equipo}` },
        { name: 'Jugador', value: `${jugador}` },
        { name: 'Director Técnico', value: `${interaction.user}` },
        { name: 'Razón', value: razon }
      );

    await interaction.reply({ embeds: [embed] });

    const memberTarget = await guild.members.fetch(jugador.id);
    await memberTarget.roles.remove(equipo.id);
  }

  // /comprar
  if (commandName === 'comprar') {
    const jugador = options.getUser('jugador');
    const clausula = options.getInteger('clausula');
    const equipo = options.getRole('equipo_nuevo');

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user} ha pagado la cláusula de ${jugador}`)
      .setColor('Blue')
      .addFields(
        { name: 'Director Técnico', value: `${interaction.user}` },
        { name: 'Jugador', value: `${jugador}` },
        { name: 'Equipo', value: `${equipo}` },
        { name: 'Cláusula Pagada', value: `💰 $${clausula}` }
      )
      .setFooter({ text: 'Hora de ver papeleos 🌐' });

    await interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
