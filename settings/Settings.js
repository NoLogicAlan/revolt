const fs = require("fs");
const { MongoClient } = require("mongodb");
const EventEmitter = require("events");

class ServerSettings {
  constructor(id, manager) {
    this.id = id;
    this.manager = manager;
    this.data = {};

    this.loadDefaults();
  }

  set(key, value) {
    this.data[key] = value;
    this.manager.update(this, key);
  }

  get(key) {
    return this.data[key];
  }

  reset(key) {
    return this.set(key, this.manager.defaults[key]);
  }

  getAll() {
    return this.data;
  }

  loadDefaults() {
    for (let key in this.manager.defaults) {
      this.data[key] = this.manager.defaults[key];
    }
  }

  deserialize(json) {
    for (let k in json) {
      this.data[k] = json[k];
    }
  }

  checkDefaults(defaults) {
    for (let key in defaults) {
      if (this.data[key] === undefined) {
        this.data[key] = defaults[key];
      }
    }
  }

  get serializationData() {
    return {
      id: this.id,
      data: this.data
    };
  }
}

class RemoteSettingsManager extends EventEmitter {
  guilds = new Map();
  defaults = {};
  descriptions = {};
  db = null;
  collection = null;

  constructor(mongoURI, dbName, defaultsPath) {
    super();

    if (defaultsPath) this.loadDefaultsSync(defaultsPath);

    const client = new MongoClient(mongoURI);

    client.connect()
      .then(() => {
        console.log("MongoDB connected");
        this.db = client.db(dbName);
        // Direct collection access instead of Mongoose Model
        this.collection = this.db.collection("ServerSettings");
        this.load();
      })
      .catch(err => {
        console.error("Mongo connection error:", err);
        // Retry logic
        setTimeout(() => new RemoteSettingsManager(mongoURI, dbName, defaultsPath), 3000);
      });
  }

  async load() {
    try {
      // Fetch all documents from the collection
      const cursor = this.collection.find();
      const results = await cursor.toArray();

      results.forEach(doc => {
        const server = new ServerSettings(doc.id, this);
        server.deserialize(doc.data);
        server.checkDefaults(this.defaults);
        this.guilds.set(server.id, server);
      });

      this.emit("ready");
    } catch (err) {
      console.error("Settings load error:", err);
      setTimeout(() => this.load(), 3000);
    }
  }

  async update(server, key) {
    if (!this.collection) {
      console.error("Database not ready! Cannot update settings.");
      return;
    }

    if (!this.guilds.has(server.id)) {
      this.guilds.set(server.id, server);
    }

    await this.collection.updateOne(
      { id: server.id },
      { $set: { [`data.${key}`]: server.data[key] } },
      { upsert: true }
    );
  }

  async saveServer(server) {
    if (!this.collection) {
      console.error("Database not ready! Cannot save server.");
      return;
    }

    await this.collection.updateOne(
      { id: server.id },
      { $set: { data: server.data } },
      { upsert: true }
    );
  }

  async saveAsync() {
    const promises = [];

    this.guilds.forEach(server => {
      promises.push(this.saveServer(server));
    });

    await Promise.allSettled(promises);
  }

  loadDefaultsSync(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    this.descriptions = parsed.descriptions;
    this.defaults = parsed.values;
  }

  isOption(key) {
    return key in this.defaults;
  }

  hasServer(id) {
    return this.guilds.has(id);
  }

  getServer(id) {
    if (!this.guilds.has(id)) {
      const server = new ServerSettings(id, this);
      this.guilds.set(id, server);
      return server;
    }

    return this.guilds.get(id);
  }
}

module.exports = {
  RemoteSettingsManager,
  ServerSettings
};
