require("dotenv").config();
const { Client } = require("discord.js");
const path = require("path");


const history = {};
const timeouts = {}

const client = new Client();

client.on("error", console.error);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}! (${client.user.id})`);
  // client.user.setActivity("Cupid 💘", { type: "PLAYING" });
});

client.on("message", async (message) => {
  if (message.content.startsWith("`join")) {
    message.guild.channels.resolve(message.content.split(" ")[1]).join();
  }
})

client.on("voiceStateUpdate", async (previous, current) => {
  // if mute/deaf changed
  if (previous.channelID === current.channelID) return;

  const member = current.member;
  const channel = current.channel;
  const oldChannel = previous.channel;

  try {
    if (channel?.name.includes("Speed Dating Lobby")) {
      channel?.fetch(1);
      onEnterLobby(member, channel);
    }
    if (/💞 Speed Dating \d+/.test(oldChannel?.name)) {
      oldChannel?.fetch(1);
      onExitRoom(oldChannel);
    }
    if (
      !channel ||
      (oldChannel?.name.includes("Speed Dating") &&
        !channel?.name.includes("Speed Dating"))
    )
      delete history[member.id];
  } catch (e) {
    console.error(e);
  }
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
  delete timeouts[channel.id];
  channel.delete();
}

function wereInRoom(a, b) {
  if (history[a.id]?.includes(b.id) || history[b.id]?.includes(a.id))
    return true;
  return false;
}

function areCompatible(a, b) {
  let canDate = true;
  const areAttracted =
    getAttractions(a).includes(getGender(b)) &&
    getAttractions(b).includes(getGender(a));

  if (preferSameContinent(a) || preferSameContinent(b)) {
    const areClose = getContinent(a) === getContinent(b);
    if (!areClose) canDate = false;
  }

  return areAttracted && canDate;
}


function preferSameContinent(member) {
  return !!member.roles.cache.find((r) =>
    r.name.includes("Distance | same continent")
  );
}


function getGender(member) {
  const pattern = /❤ (\w+)/;
  return member.roles.cache
    .find((r) => pattern.test(r.name))
    ?.name.match(pattern)[1];
}

function getAttractions(member) {
  const pattern = /Attracted to (\w+)/
  return member.roles.cache
    .filter((r) => pattern.test(r.name))
    .array()
    .map((r) => r.name.match(pattern)[1])
    .map((g) => (g === "men" ? "man" : g === "women" ? "woman" : g))
    .map((g) => g.charAt(0).toUpperCase() + g.slice(1));
}

function getContinent(member) {
  const pattern = /🌎 (\w+)/
  return member.roles.cache
    .find((r) => pattern.test(r.name))
    ?.name.match(pattern)[1];
}

function getAge(member) {
  const regex = /Age: (\d+)/
  return member.roles.cache
    .find((r) => regex.test(r.name))
    ?.name.match(regex)[1];
}

async function placeInRoom([a, b], lobby) {
  const ah = history[a.id] = history[a.id] || [];
  const bh = history[b.id] = history[b.id] || [];

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
      await a.voice.setChannel(newChannel);
      await b.voice.setChannel(newChannel);

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
