import { MySqlSettingsManager, SettingsManager } from "../src/Settings.mjs";
import * as fs from "node:fs";
import path from "node:path";

const __dirname = import.meta.dirname;
const configPath = path.join(__dirname, "../config.json");
const config = JSON.parse(fs.readFileSync(configPath));

const sm = new SettingsManager(); // in-memory only for migration source
const rsm = new MySqlSettingsManager(config.mysql);

// Load defaults for in-memory manager
const defaults = JSON.parse(fs.readFileSync("./storage/defaults.json", "utf8"));
sm.defaults = defaults.values;

// When remote is ready, push all local settings to remote
rsm.on("ready", async () => {
  const servers = sm.guilds.entries();
  for (const [id, s] of servers) {
    console.log(id);
    if (rsm.hasServer(id)) {
      await rsm.remoteSave(s);
      continue;
    }

    await rsm.create(id, s);
  }

  process.exit(0);
});
