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
    this.enabld = opts.enabled;
    this.remix = remix;

    if (!this.enabled) return this;

    this.redis = new RedisHandler(opts.redis);
    this.redis.setRequestHandler(async (data) => {
        switch (data.type) {
          case "fetchPlayers":
            return this.remix.players.channelList();
        }
      })
  }
}
