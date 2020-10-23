require("dotenv").config();
const { CommandoClient } = require("discord.js-commando");
const path = require("path");

const match = {
  ManHeterosexual: ["WomanHeterosexual", "WomanBisexual"],
  ManHomosexual: ["ManHomosexual", "ManBisexual"],
  WomanHeterosexual: ["ManHeterosexual", "ManBisexual"],
  WomanHomosexual: ["WomanHomosexual", "WomanBisexual"],
};
match.ManBisexual = [...match.ManHeterosexual, ...match.ManHomosexual];
match.WomanBisexual = [...match.WomanHeterosexual, ...match.WomanHomosexual];

const history = {};
const timeouts = {}

const client = new CommandoClient({
  commandPrefix: "~",
  owner: "542414827851612164",
});

client.registry
  .registerDefaultTypes()
  .registerDefaultGroups()
  .registerDefaultCommands()
  // .registerGroups([["admin", "Administrator commands"]])
  .registerCommandsIn(path.join(__dirname, "commands"));

client.on("error", console.error);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}! (${client.user.id})`);
  // client.user.setActivity("Cupid 💘", { type: "PLAYING" });
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // if mute/deaf changed
  if (oldState.channelID === newState.channelID) return;

  const member = newState.member;
  const channel = await newState.channel?.fetch(1);
  const oldChannel = await oldState.channel?.fetch(1);

  if (channel?.name?.includes("Speed Dating Lobby"))
    onEnterLobby(member, channel);
  if (/💞 Speed Dating \d+/.test(oldChannel?.name)) onExitRoom(oldChannel);
  if (
    !channel ||
    (oldChannel?.name.includes("Speed Dating") &&
      !channel?.name.includes("Speed Dating"))
  )
    delete history[member.id];
});

client.login(process.env.TOKEN);

function onEnterLobby(a, channel) {
  const members = channel.members.filter((member) => member.id !== a.id);

  for (const [, b] of members) {
    if (wereInRoom(a, b)) continue;

    if (areCompatible(a, b)) {
      placeInRoom([a, b], channel);
      break;
    }
  }
}

function onExitRoom(channel) {
  if (channel.members.size) return;
  client.clearTimeout(timeouts[channel.id]);
  console.log(timeouts[channel.id]);
  delete timeouts[channel.id];
  channel.delete();
}

function wereInRoom(a, b) {
  if (history[a.id]?.includes(b.id) || history[b.id]?.includes(a.id))
    return true;
  return false;
}

function areCompatible(a, b) {
  const gender1 = sexOf(a) + orientationOf(a);
  const gender2 = sexOf(b) + orientationOf(b);

  return !!match[gender1]?.includes(gender2) 
}

function sexOf(member) {
  return member.roles.cache.find((r) => r.name === "Woman" || r.name === "Man")
    ?.name;
}

function orientationOf(member) {
  return member.roles.cache.find((r) => r.name.includes("sexual"))?.name;
}

async function placeInRoom([a, b], lobby) {
  const ah = history[a.id] = history[a.id] || [];
  const bh = history[b.id] = history[b.id] || [];

  await lobby.fetch(1)

  const parent = await lobby.parent.fetch(1);

  const last = parent.children
    .filter((c) => /Speed Dating \d+/.test(c.name))
    .sort((a, b) => a.position - b.position)
    .last();
  
  const count = parseInt(last?.name.match(/\d+/)?.[0] || 0, 10) + 1;

  lobby.guild.channels
    .create(`💞 Speed Dating ${count}`, {
      parent,
      type: "voice",
      userLimit: 2,
    })
    .then(async (newChannel) => {
      a.voice.setChannel(newChannel);
      b.voice.setChannel(newChannel);

      timeouts[newChannel.id] = client.setTimeout(
        (chan) => {
          chan.members.each((m) => m.voice.setChannel(lobby));
        },
        5 * (60 * 1000),
        // 5000,
        newChannel
      );
    });

  if (ah.includes(b.id) || bh.includes(a.id)) return;
  history[a.id].push(b.id);
  history[b.id].push(a.id);
}
