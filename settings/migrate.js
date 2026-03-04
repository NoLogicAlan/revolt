const { SettingsManager, RemoteSettingsManager } = require("./Settings.js");
const config = require("../config.json");

const sm = new SettingsManager();

// Update: Pass the URI and Database name from your new MongoDB config
const rsm = new RemoteSettingsManager(
  config.mongodb.uri, 
  config.mongodb.database,
  "./path/to/defaults.json" // Make sure this path is correct
);

const servers = sm.guilds.entries();

rsm.on("ready", async () => {
  for (const [id, s] of servers) {
    console.log(`Syncing server: ${id}`);
    
    // In the MongoDB version we wrote, we use saveServer or update
    // to handle both creating and updating (upserting)
    try {
      await rsm.saveServer(s);
      console.log(`Successfully synced ${id}`);
    } catch (err) {
      console.error(`Failed to sync ${id}:`, err);
    }
  }

  console.log("Migration/Sync complete.");
  process.exit(0); // Exit with 0 for success
});