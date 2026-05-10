import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder()
  .setName("pause")
  .setDescription("Pause the playback in your voice channel", "commands.pause");
export const run = async function(message) {
  const p = await this.getPlayer(message);
  if (!p) return;
  let res = p.pause() || `✅ The song has been paused!`;
  message.channel.sendEmbed(res);
}
