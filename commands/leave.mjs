import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder()
  .setName("leave")
  .setDescription("Make the bot leave your current voice channel", "commands.leave")
  .addAliases("l", "stop");
export const run = async function (msg) {
  const p = await this.getPlayer(msg, false, false);
  if (!p) return;
  if (!p.connection) return msg.replyEmbed("Player not initialized.");
  const cid = p.connection.channelId;
  this.players.leave(msg, cid);
};
