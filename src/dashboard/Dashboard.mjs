import { Channel, Server, User, VoiceParticipant } from "revolt.js";
import { Remix } from "../../index.mjs";
import { CommandBuilder, CommandHandler, Option } from "../CommandHandler.mjs";
import Player from "../Player.mjs";
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
          return this.remix.players.playerList().map(p => Dashboard.convertPlayer(p));
        case "user":
          return Dashboard.convertUser(this.remix.client.users.get(data.key));
        case "commands":
          return this.remix.handler.commands.map(c => Dashboard.convertCommand(c, this.remix.handler));
      }
    });
    this.redis.send("info", JSON.stringify({
      platform: "stoat",
      type: "connected"
    }));
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
   * @typedef {Object} Video
   * @property {("radio"|"video"|"external")} type
   * @property {string} title
   * @property {string} description
   * @property {string} videoId
   * @property {string} url
   * @property {string} [spotifyUrl]
   * @property {string} artist Used if type === "external"
   * @property {Object[]} [artists]
   * @property {string} artists[].name
   * @property {string} artists[].url
   * @property {Object} author
   * @property {string} author.name
   * @property {string} author.url
   */
  /**
   * @param {Video} vid
   */
  static convertVideo(vid) {
    if (!vid) return null;
    return {
      title: vid.title,
      url: (vid.type === "radio") ? vid.author.url : vid.url,
      videoId: vid.videoId,
      type: vid.type,
      duration: (typeof vid.duration === "object") ? vid.duration.timestamp : Utils.prettifyMS(duration, "h:!m:!s"),
      description: vid.description,
      artist: {
        name: vid.author.name || vid.artist,
        url: vid.author.url
      },
      thumbnail: vid.thumbnail
    }
  }
  /**
   * @param {Channel} channel
   */
  static convertChannel(channel) {
    return {
      name: channel.name,
      displayName: channel.displayName,
      id: channel.id,
      icon: channel.iconURL || null,
      description: channel.description,
      isVoice: channel.isVoice,
      voiceParticipants: Array.from(channel.voiceParticipants.values()).map(p => {
        return Dashboard.convertUser(p.client.users.get(p.userId)); // VoiceParticipant appears to have a client property with a client object
      }),
      mature: channel.mature,
      serverId: channel.serverId
    }
  }
  /**
   * @param {Server} server
   */
  static convertServer(server) {
    return {
      name: server.name,
      id: server.id,
      icon: server.iconURL || null,
      channelIds: Array.from(server.channelIds.values()),
      description: server.description,
      ownerId: server.ownerId
    }
  }
  /**
   *
   * @param {Player} player
   */
  static convertPlayer(player) {
    const channel = player.client.channels.get(player.connection.channelId);
    return {
      loop: (player.queue.loop * 1) + (player.queue.songLoop * 2), // decode using bitwise shifts
      paused: player.paused,
      volume: (player.connection?.preferredVolume || 1) * 100,
      queue: {
        current: Dashboard.convertVideo(player.queue.current),
        data: player.queue.data.map(v => Dashboard.convertVideo(v))
      },
      channel: (!!player.connection) ? Dashboard.convertChannel(channel) : null,
      server: (!!player.connection) ? Dashboard.convertServer(channel.server) : null,
    }
  }
  /**
   * @param {Option} opt
   */
  static convertOption(opt) {
    return {
      type: opt.type,
      name: opt.name,
      choices: opt.choices,
      description: opt.description,
      required: opt.required,
      uid: opt.uid,
      defaultValue: opt.defaultValue,
      dynamicDefaultPresent: !!opt.dynamicDefault
    }
  }
  /**
   *
   * @param {CommandBuilder} com
   * @param {CommandHandler} commands
   * @returns
   */
  static convertCommand(com, commands) {
    return {
      name: com.name,
      description: com.description,
      uid: com.uid,
      aliases: com.aliases,
      subcommands: com.subcommands.map(c => Dashboard.convertCommand(c, commands)),
      category: com.category,
      examples: com.examples,
      usage: commands.helpHandler.commandUsage(com, {
        message: {
          server: { id: "01FZ62C8WFS3HBEN5QTN8RZRQG" }
        }
      }),
      // TODO: add requirements
      options: com.options.map(o => Dashboard.convertOption(o)),
    }
  }
  update() {

  }
  /**
   * Global player update
   * @param {Object} details
   * @param {Player} player
   */
  playerUpdate(details, player) {
    const serialised = Dashboard.convertPlayer(player);
    this.redis.send(this.redis.platform + "_players", JSON.stringify({
      ...details,
      player: serialised
    }));
  }
  /**
   * @param {Object} details
   * @param {Player} player
   */
  updatePlayer(details, player) {
    const channel = this.redis.platform + "_player_" + player.connection.channelId;
    this.redis.send(channel, JSON.stringify(details));
  }
  /**
   * @param {Object} details
   * @param {User} user
   */
  userUpdate(details, user) {
    const channel = this.redis.platform + "_users";
    this.redis.send(channel, JSON.stringify({
      ...details,
      user: Dashboard.convertUser(user)
    }));
  }
  updateUser(details, user) {
    const channel = this.redis.platform + "_user_" + user.id;
    this.redis.send(channel, JSON.stringify(details));
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
