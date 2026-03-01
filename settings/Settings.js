const fs = require("fs");
const mysql = require("mysql");
const EventEmitter = require("events");

class ServerSettings {
    id;
    manager;
    data = {};

    constructor(id, mgr) {
        this.id = id;
        this.manager = mgr;
        this.loadDefaults();
        return this;
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
            if (k == "id") continue;
            this.data[k] = json[k];
        }
    }

    checkDefaults(d) {
        for (let key in d) {
            if (this.data[key] === undefined) this.data[key] = d[key];
        }
    }

    get serializationData() {
        return {
            ...this.data,
            id: this.id
        };
    }

    serialize() {
        return this.serializationData;
    }

    serializeObject() {
        return this.serializationData;
    }
}

class RemoteSettingsManager extends EventEmitter {
    guilds = new Map();
    descriptions = {};
    defaults = {};
    db = null;

    constructor(config, defaultsPath) {
        super();

        // config should be your "mysql" object from config.json
        this.db = mysql.createPool({
            connectionLimit: 15,
            ...config,
            // Forces SSL if not explicitly disabled, required for TiDB/Cloud
            ssl: config.ssl || { minVersion: "TLSv1.2", rejectUnauthorized: true }
        });

        if (defaultsPath) this.loadDefaultsSync(defaultsPath);

        this.load();
    }

    // Safer query helper using parameterized values
    query(sql, values = []) {
        return new Promise(res => {
            this.db.query(sql, values, (error, results, fields) => {
                res({ error, results, fields });
            });
        });
    }

    async load() {
        const res = await this.query("SELECT * FROM settings");
        if (res.error) {
            console.error("Settings init error:", res.error.message);
            console.log("Retrying in 2 seconds...");
            return setTimeout(() => this.load(), 2000);
        }

        res.results.forEach((r) => {
            let server = new ServerSettings(r.id, this);
            // TiDB/MySQL sometimes returns JSON as a string, sometimes as an object
            const parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
            server.deserialize(parsedData);
            server.checkDefaults(this.defaults);
            this.guilds.set(server.id, server);
        });

        this.emit("ready");
    }

    async remoteUpdate(server, key) {
        // Uses JSON_SET safely with parameterized queries
        const sql = "UPDATE settings SET data = JSON_SET(data, ?, ?) WHERE id = ?";
        const path = `$.${key}`;
        const r = await this.query(sql, [path, server.data[key], server.id]);
        if (r.error) console.error("Settings update error:", r.error);
    }

    async remoteSave(server) {
        const sql = "UPDATE settings SET data = ? WHERE id = ?";
        const r = await this.query(sql, [JSON.stringify(server.data), server.id]);
        if (r.error) console.error("Settings server save error:", r.error);
    }

    loadDefaultsSync(filePath) {
        const d = fs.readFileSync(filePath, "utf8");
        let parsed = JSON.parse(d);
        this.descriptions = parsed.descriptions;
        this.defaults = parsed.values;
    }

    saveAsync() {
        return new Promise(async (res) => {
            const p = [];
            this.guilds.forEach((val) => {
                p.push(this.remoteSave(val));
            });
            await Promise.allSettled(p);
            res();
        });
    }

    async create(id, server) {
        const sql = "INSERT INTO settings (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)";
        const r = await this.query(sql, [id, JSON.stringify(server.data)]);
        if (r.error) console.error("Settings create server error:", r.error);
    }

    update(server, key) {
        if (!this.guilds.has(server.id)) {
            this.guilds.set(server.id, server);
            this.create(server.id, server);
        } else {
            const s = this.guilds.get(server.id);
            s.data[key] = server.data[key];
            this.remoteUpdate(server, key);
        }
    }

    isOption(key) {
        return key in this.defaults;
    }

    hasServer(id) {
        return this.guilds.has(id);
    }

    getServer(id) {
        if (!this.guilds.has(id)) {
            const newServer = new ServerSettings(id, this);
            this.guilds.set(id, newServer);
            this.create(id, newServer);
            return newServer;
        }
        return this.guilds.get(id);
    }
}

module.exports = { RemoteSettingsManager, ServerSettings };