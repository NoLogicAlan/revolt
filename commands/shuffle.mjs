import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder()
  .setName("shuffle")
  .setDescription("Re-orders the queue randomly.", "commands.shuffle");
export const run = async function(message) {
  const p = await this.getPlayer(message);
  if (!p) return;
  let res = p.shuffle() || `✅ Shuffled!`;
  message.channel.sendEmbed(res);
}
