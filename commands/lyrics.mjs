import { CommandBuilder } from "../src/CommandHandler.mjs";

// TODO: add fetching of lyrics for song queries
export const command = new CommandBuilder()
  .setName("lyrics")
  .setDescription("Fetch the lyrics of the current song. Please note that the lyrics might differ from the actual ones, as Genius doesn't always find the right song.", "commands.lyrics")
  .addAliases("lyric");
export const run = async function (message) {
  const p = await this.getPlayer(message);
  if (!p) return;

  const n = message.replyEmbed("Fetching lyrics from genius...");

  var data = await p.lyrics();
  if (!data.provider) return (await n).editEmbed("Couldn't find the lyrics for this song!");
  if (data.lines.length == 0) return message.replyEmbed("There's nothing playing at the moment.");
  const messages = data.lines;
  (await n).message.delete();
  this.pagination("Lyrics for " + p.getVideoName(p.queue.getCurrent()) + ": \n```\n$content\n```\nSource: `" + data.provider + "`\n\nPage $currentPage/$maxPage", messages, message, 15)
}
