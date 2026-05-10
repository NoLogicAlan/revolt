import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder()
  .setName("skip")
  .setDescription("Skip the current playing song.", "commands.skip");
export const run = async function(message) {
  const p = await this.getPlayer(message);
  if (!p) return;
  let res = p.skip() || `✅ Song skipped!`;
  message.channel.sendEmbed(res);
}
