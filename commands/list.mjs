import { CommandBuilder } from "../src/CommandHandler.mjs";
import Player from "../src/Player.mjs";

export const command = new CommandBuilder()
  .setName("list")
  .setDescription("List the songs in the queue of your current voice channel.", "commands.list")
  .addAliases("queue", "q");
export const run = async function (message) {
  /** @type {Player} */
  const p = await this.getPlayer(message);
  if (!p) return;
  const data = p.list();
  data.current ||= {
    title: "unknown",
    artist: "unknown"
  }
  const form = "## Queue\n"
    + "📋 " + data.queue.length + " tracks in queue • ⏰ `" + data.totalTime.timestamp + "`\n\n"
    + "### 🎵 Now Playing\n0. [" + data.current.artist + " - " + data.current.title + "](" + data.current.url + ") `" + data.current.elapsed + " / " + data.current.duration + "`\n\n"
    + "### ⌛ In Queue\n$content\n\nPage $currentPage/$maxPage";
  const content = data.queue.map((v, i) => {
    return (i + 1) + ". [" + v.artist + " - " + v.title + "](" + v.url + ") • `" + v.duration + "`";
  });
  this.pagination(form, (content.length != 0) ? content : ["**Queue empty**"], message, 10);
};
