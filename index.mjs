import * as fs from "fs";
import path from "path";
import { Client } from "revolt.js"
import { CommandHandler, CommandLoader, PrefixManager } from "./src/CommandHandler.mjs";
import { MessageHandler } from "./src/MessageHandler.mjs";
import { MySqlSettingsManager } from "./src/Settings.mjs";

const config = JSON.parse(fs.readFileSync("config.json"));

const client = new Client();
const messages = new MessageHandler(client);
const commands = new CommandHandler(messages);
const settings = new MySqlSettingsManager(config.mysql, "./storage/defaults.json");

commands.setPrefixManager(new PrefixManager(settings));

client.on("ready", () => {
  console.log("ready");
});

const __dirname = import.meta.dirname;

const dir = path.join(__dirname, "commands");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
const commandFiles = new Map();
const runnables = new Map();

Promise.all(files.map(async commandFile => {
  const file = path.join(dir, commandFile);
  const cData = await import(file);
  console.log(cData, cData.default);
})).then(async () => {
  //console.log(await import("./src/CommandHandler.mjs"))
  console.log("loaded");
});

const loader = new CommandLoader(commands, {
  config,
  settingsMgr: settings

});
loader.loadFromDir(dir);

client.loginBot(config.token);
