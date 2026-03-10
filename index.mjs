import * as fs from "fs";
import path from "path";
import { Client } from "revolt.js"
import { CommandHandler, CommandLoader, PrefixManager } from "./src/CommandHandler.mjs";
import { MessageHandler } from "./src/MessageHandler.mjs";
import { MySqlSettingsManager } from "./src/Settings.mjs";
import Revoice from "revoice.js/src/Revoice.js";
import YTDlpWrapE from "yt-dlp-wrap-extended";
const YTDlpWrap = YTDlpWrapE.default;

class Remix {
  constructor() {
    const config = JSON.parse(fs.readFileSync("config.json"));
    this.config = config;

    const client = new Client();
    this.client = client;
    const messages = new MessageHandler(this.client);
    const commands = new CommandHandler(messages);
    const settings = new MySqlSettingsManager(config.mysql, "./storage/defaults.json");
    this.settingsMgr = settings;
    this.handler = commands;

    commands.setPrefixManager(new PrefixManager(settings));
    commands.onPing = (msg) => {
      msg.replyEmbed(this.handler.format("My prefix in this server is `$prefix`\n\nRun `$prefix$helpCmd` to get started!", msg.message.server.id), false, {
        icon_url: (msg.channel.channel.server.icon) ? "https://autumn.revolt.chat/icons/" + msg.channel.channel.server.icon.id : null,
        title: msg.channel.channel.server.name
      });
    }

    client.on("ready", () => {
      console.log("ready");
    });

    const loader = new CommandLoader(commands, this);
    const __dirname = import.meta.dirname;
    const dir = path.join(__dirname, "commands");
    loader.loadFromDir(dir);

    this.revoice = new Revoice(config.token || config.login, config["revolt-api"]);
    this.observedVoiceUsers = new Map();
    if (!fs.existsSync("./bin")) fs.mkdirSync("./bin");
    const ytdlPath = path.join(__dirname, "./bin/ytdlp.bin");
    if (!fs.existsSync(ytdlPath)) {
      console.log("Downloading yt-dlp binaries.");
      YTDlpWrap.downloadFromGithub(ytdlPath).then(() => {
        console.log("Finished downloading yt-dlp binaries.");
        this.ytdlp = new YTDlpWrap(ytdlPath);
      });
    } else {
      this.ytdlp = new YTDlpWrap(ytdlPath);
    }

    try {
      this.comHash = require('child_process')
        .execSync('git rev-parse --short HEAD', { cwd: __dirname })
        .toString().trim();
      this.comHashLong = require('child_process')
        .execSync('git rev-parse HEAD', { cwd: __dirname })
        .toString().trim();
    } catch (e) {
      console.log("Git comhash error");
      this.comHash = "Newest";
      this.comHashLong = null;
    }

    this.comLink = (this.comHashLong) ? "https://github.com/remix-bot/stoat/tree/" + this.comHashLong : "https://github.com/remix-bot/stoat";
    this.playerMap = new Map();
    this.currPort = -1;
    this.channels = [];
    this.freed = [];

    client.loginBot(config.token);
  }

  getSettings(message) {
    const serverId = message.channel.channel.serverId;
    return this.settingsMgr.getServer(serverId);
  }
}

const remix = new Remix();
