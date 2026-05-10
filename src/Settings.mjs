import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as mysql from "mysql";

export class ServerSettings {
  /** @type {string} */
  id;
  /** @type {SettingsManager} */
  manager;
  data = {};

  constructor(id, mgr) {
    this.id = id; this.manager = mgr;

    this.loadDefaults();
  }
  /**
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.data[key] = value;
    this.manager.update(this, key);
  }
  /**
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    return this.data[key];
  }
  /**
   * @param {string}
   */
  reset(key) {
    return this.set(key, this.manager.defaults[key]);
  }
  /**
   * @returns {Object}
   */
  getAll() {
    return this.data;
  }

  loadDefaults() {
    for (let key in this.manager.defaults) {
      this.data[key] = this.manager.defaults[key];
    }
  }
  checkDefaults(d) {
    for (let key in d) {
      if (!this.data[key]) this.data[key] = d[key];
    }
  }
  deserialize(json) {
    for (let k in json) {
      if (k == "id") continue;
      this.data[k] = json[k];
    }
  }
  get serializationData() {
    return {
      ...this.data,
      id: this.id
    }
  }
  serialize() {
    return this.serializationData;
  }
serializeObject() {
    return this.serializationData;
  }
}

export class SettingsManager extends EventEmitter {
  /**
   * @abstract
   * @type {Object}
   */
  defaults;
  /**
   * @abstract
   * @param {string} server
   * @param {string} key
   */
  update(server, key) { }
  /**
   * @abstract
   * @param {string} id
   * @returns {ServerSettings}
   */
  getServer(id) { }
  /**
   * @abstract
   * @param {string} id
   * @returns {boolean}
   */
  hasServer(id) { }
  /**
   * @abstract
   * @param {string} key
   * @returns {boolean}
   */
  isOption(key) { }
}
export class MySqlSettingsManager extends SettingsManager {
  // TODO: setup instructions
  guilds = new Map();
  descriptions = {};
  defaults = {};

  serverConfig = null;

  db = null;

  /**
   *
   * @param {Object} config MySQL pool creation options.
   * @param {string} defaultsPath Path to the json file containing the default values
   * @returns
   */
  constructor(config, defaultsPath) {
    super();

    this.db = mysql.createPool({
      connectionLimit : 15,
      ...config
    });

    if (defaultsPath) this.loadDefaultsSync(defaultsPath);

    this.load();
  }

  query(query) {
    return new Promise(res => {
      this.db.query(query, (error, results, fields) => { res({ error, results, fields })});
    });
  }

  _loadRetryTimer = null;

  async load() {
    const res = await this.query("SELECT * FROM settings");
    if (res.error) {
      console.error("settings init error; ", res.error);
      console.error("retrying in 2 seconds");
      this._loadRetryTimer = setTimeout(() => {
        this.load();
      }, 2000);
      return;
    }
    this._loadRetryTimer = null;

    const results = res.results;
    results.forEach((r) => {
      let server = new ServerSettings(r.id, this);
      server.deserialize(JSON.parse(r.data));
      server.checkDefaults(this.defaults);
      this.guilds.set(server.id, server);
    });

    this.emit("ready");
  }
  async remoteUpdate(server, key) {
    // Validate key to prevent SQL injection - only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      console.error("settings update error; invalid key: ", key);
      return;
    }
    const escapedValue = this.db.escape(String(server.data[key]));
    const escapedId = this.db.escape(server.id);
    const r = await this.query("UPDATE settings SET data = JSON_SET(data, '$." + key + "', " + escapedValue + ") WHERE id=" + escapedId)
    if (r.error) console.error("settings update error; ", r.error);
  }
  async remoteSave(server) {
    const escapedData = this.db.escape(JSON.stringify(server.data));
    const escapedId = this.db.escape(server.id);
    const r = await this.query("UPDATE settings SET data = " + escapedData + " WHERE id=" + escapedId);
    if (r.error) console.error("settings server save error; ", r.error);
  }

  loadDefaultsSync(filePath) {
    const d = fs.readFileSync(filePath, "utf8");
    let parsed = JSON.parse(d);
    this.descriptions = parsed.descriptions;
    this.defaults = parsed.values;
  }

  saveAsync() {
    return new Promise(async (res) => {
      const p = []; // promises
      this.guilds.forEach((val, _k) => {
        p.push(this.remoteSave(val));
      });

      await Promise.allSettled(p);
      res();
    });
  }
  async create(id, server) {
    const escapedId = this.db.escape(id);
    const escapedData = this.db.escape(JSON.stringify(server.data));
    const r = await this.query("INSERT INTO settings (id, data) VALUES (" + escapedId + ", " + escapedData + ")");
    if (r.error) console.error("settings create server error; ", r.error);
  }

  update(server, key) {
    if (!this.guilds.has(server.id)) {
      this.guilds.set(server.id, server);
      this.create(server.id, server);
    }
    const s = this.guilds.get(server.id);
    s.data[key] = server.data[key];
    this.remoteUpdate(server, key);
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
      this.create(id, server);
    }
    return this.guilds.get(id);
  }
  deleteServer(id) {
    this.guilds.delete(id);
  }
  close() {
    if (this._loadRetryTimer) {
      clearTimeout(this._loadRetryTimer);
      this._loadRetryTimer = null;
    }
    if (this.db) {
      this.db.end();
    }
  }
}
