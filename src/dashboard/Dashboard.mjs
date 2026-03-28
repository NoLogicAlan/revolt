import { User } from "revolt.js";
import { Remix } from "../../index.mjs";
import { Utils } from "../Utils.mjs";
import { DatabaseManager } from "./DatabaseManager.mjs";
import { RedisHandler } from "./RedisHandler.mjs";

export class Dashboard {
  enabled = false;
  expiryTime = 1000 * 60 * 60 * 6;
  /**
   *
   * @param {Remix} remix
   * @param {Object} opts
   * @param {boolean} opts.enabled Wether the Dashboard is enabled and connections should be attempted
   * @param {Object} opts.redis
   * @param {string} opts.redis.url Connection string in the following format: redis[s]://[[username][:password]@][host][:port][/db-number]
   * @param {Object} opts.mysql
   */
  constructor(remix, opts) {
    this.enabled = opts?.enabled;
    this.remix = remix;

    if (!this.enabled) return this;

    this.db = new DatabaseManager(opts.mysql);

    this.redis = new RedisHandler(opts.redis);
    this.redis.setRequestHandler(async (data) => {
      switch (data.type) {
        case "fetchPlayers":
          return this.remix.players.channelList();
        case "user":
          return Dashboard.convertUser(this.remix.client.users.get(data.key));
      }
    })
  }
  /**
   * @typedef APIUser
   * @property {string} id
   * @property {string} discriminator
   * @property {string} username
   * @property {string} displayName
   * @property {Object} avatar
   * @property {string} avatar.url
   */
  /**
   * @param {User} user
   * @returns {APIUser}
   */
  static convertUser(user) {
    return {
      id: user.id,
      discriminator: user.discriminator,
      username: user.username,
      displayName: user.displayName,
      avatar: {
        url: user.avatarURL || user.defaultAvatarURL
      },
    }
  }
  /**
   *
   * @param {string} user
   * @param {string} code
   * @returns {Promise<string|null>} null == success
   */
  async confirmLogin(user, code) {
    if (!this.enabled) return "Dashboard not enabled.";
    var res;
    try {
      res = await this.db.execute("SELECT * FROM login_codes WHERE user=?", [user]);
    } catch (e) {
      const id = Utils.uid();
      console.log("[Dashboard] Mysql error, id: ", id, e);
      return "An error occured, please contact an administrator if this happens again. Error id: `" + id + "`";
    }
    if (res.length === 0) return "If this is a valid code, it was not created for your account.";
    for (let i = 0; i < res.length; i++) {
      if ((await this.db.compareHash(code, res[i].token))) {
        if (Date.now() - this.expiryTime > (new Date(res[i].createdAt)).getTime()) return res("Login token expired");
        await this.db.execute("UPDATE login_codes SET verified=true WHERE id=?", [res[i].id]);
        return null;
      }
    }
    return "Invalid code.";
  }
}
