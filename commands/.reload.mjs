import { CommandBuilder } from "../src/CommandHandler.mjs";
import * as fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const command = new CommandBuilder()
  .setName("reload")
  .setDescription("Reload a specified command.")
  .addStringOption(o =>
    o.setName("command")
      .setDescription("The name of the root command that should be reloaded.")
      .setRequired(true)
  ).addRequirement(r =>
    r.setOwnerOnly(true)
  );
export const run = async function(msg, data) {
  const com = data.get("command").value;
  if (com == "scandir") {
    // TODO: scanning for new commands - dynamic import doesn't have cache busting like CJS require
    return msg.replyEmbed("Scan dir is not supported in ESM mode yet.");
  }
  const command = this.handler.commands.find(c => c.name == com);
  if (!command) return msg.replyEmbed("Unknown Command");

  // remove all references
  command.subcommands.forEach(sub => {
    this.loader.runnables.delete(sub.uid);
  });
  this.handler.removeCommand(command);
  this.loader.runnables.delete(command.uid);

  const file = this.loader.commandFiles.get(command.uid);
  this.loader.commandFiles.delete(command.uid);

  // ESM dynamic import with cache busting via query string
  try {
    const cData = this.loader.canonData(await import(pathToFileURL(file).href + "?t=" + Date.now()));
    const builder = (typeof cData.command === "function") ? cData.command.call(this) : cData.command;
    if (!builder) return msg.replyEmbed("No builder returned. Skipping '" + com + "'");
    if (cData.export) this[cData.export.name] = cData.export.object;
    this.handler.addCommand(builder);
    if (cData.run) {
      this.loader.runnables.set(builder.uid, cData.run);
      builder.subcommands.forEach(sub => {
        this.loader.runnables.set(sub.uid, cData.run);
      });
    }
    this.loader.commandFiles.set(builder.uid, file);
    msg.replyEmbed("Successfully reloaded!");
  } catch (e) {
    msg.replyEmbed("Reload failed: `" + e.message + "`");
    console.error("[Reload] Error:", e);
  }
}
