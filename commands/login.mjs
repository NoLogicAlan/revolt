import { CommandBuilder } from "../src/CommandHandler.mjs";

export const command = new CommandBuilder() // TODO: maybe move to own website category?
  .setName("login")
  .setDescription("Confirm a login of your account on the website", "commands.login")
  .setCategory("util")
  .addStringOption(o =>
    o.setName("id")
      .setDescription("The id you got from logging in at the dashboard.", "options.login.id")
      .setRequired(true));
export const run = async function (msg, data) { // TODO: temporary login (without creating account)
  const log = data.get("id").value;
  const verified = await this.dashboard.confirmLogin(msg.author.id, log);
  const m = (verified !== null)
    ? "Login failed! Reason: `" + verified + "`. If this is an error and the issue persist, please contact a team member through the server in my description."
    : "Login succeeded! You can continue to the webpage now.";
  msg.replyEmbed(m);
};
