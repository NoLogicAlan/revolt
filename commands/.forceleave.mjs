import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder()
  .setName("forceleave")
  .addAlias("fl")
  .setDescription("Make Remix leave a channel even if you're not in it.")
  .addRequirement(r => r.addPermission("ManageChannel"))
  .addChannelOption(o =>
    o.setName("channelId")
      .setDescription("The channel that should be left.")
      .setRequired(true)
  );
export const run = async function(msg, data) {
  const cid = data.get("channelId").value;
  if (msg.channel.server.id !== this.client.channels.get(cid)?.server.id) return msg.replyEmbed("This command has to be run in the same server as the voice channel.");
  const p = this.players.playerMap.get(cid);
  if (!p) return msg.replyEmbed("Player not found");
  if (!p.connection) return msg.replyEmbed("Player not initialized.");
  this.players.leave(msg, cid);
}
