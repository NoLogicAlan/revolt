import { User } from "revolt.js";
import { Remix } from "../../index.mjs";
import { RedisHandler } from "./RedisHandler.mjs";

export class Dashboard {
  enabled = false;
  /**
   *
   * @param {Remix} remix
   * @param {Object} opts
   * @param {boolean} opts.enabled Wether the Dashboard is enabled and connections should be attempted
   * @param {Object} opts.redis
   * @param {string} opts.redis.url Connection string in the following format: redis[s]://[[username][:password]@][host][:port][/db-number]
   */
  constructor(remix, opts) {
    this.enabled = opts.enabled;
    this.remix = remix;

    if (!this.enabled) return this;

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
}
