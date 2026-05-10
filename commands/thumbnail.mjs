import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder()
  .setName("thumbnail")
  .setDescription("Request the thumbnail of the currently playing song.", "commands.thumbnail")
  .addAliases("thumb");
export const run = async function(msg) {
  const p = await this.getPlayer(msg);
  if (!p) return;
  let data = await p.getThumbnail();
  msg.channel.sendEmbed(data.msg, false, {
    media: data.image
  });
}
