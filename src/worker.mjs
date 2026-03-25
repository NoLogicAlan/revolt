import { workerData, parentPort } from "node:worker_threads";
import { EventEmitter } from "node:events";
import { Manager, Node, Track } from "moonlink.js";
import * as fs from "node:fs";

import { PROVIDERS } from "./constants/Providers.mjs";
import { Utils } from "./Utils.mjs";
import path from "node:path";

export class YTUtils extends EventEmitter {
  constructor() {
    super();

    const __dirname = import.meta.dirname;
    const configPath = path.join(__dirname, "../config.json")
    const config = JSON.parse(fs.readFileSync(configPath));

    this.nodelink = new Manager({
      nodes: config.nodelink.nodes,
      options: {
        clientName: "RemixStoat-Worker/1.0.0"
      }
    });

    this.ready = false;
    this.nodelink.init("648200414054842368").then(() => {
      this.emit("ready");
      this.ready = true;
    });
  }
  /**
   * @returns {Promise<undefined>} Resolves once this class is initialised.
   */
  waitReady() {
    if (this.ready) return;
    return new Promise((res) => {
      this.once("ready", res);
    });
  }
  /**
   * @returns {Promise<Node>}
   */
  async getNode() {
    await this.waitReady();
    const node = this.nodelink.nodes.findNode();
    if (node) return node;

    return new Promise((res) => {
      this.nodelink.once("nodeReady", () => {
        res(this.nodelink.nodes.findNode());
      });
    })
  }

  /**
   * Strips a title string of common suffixes and other additions that are not part of the actual title.
   * @param {string} title
   * @returns {string}
   */
  cleanTitle(title) {
    return title
        // Remove feat/ft/remix/edit/version/prod inside parentheses or brackets
        .replace(/\s*[\(\[][^\)\]]*(?:feat|ft|remix|edit|version|prod)[^\)\]]*[\)\]]/gi, "")
        // Remove feat/ft after a dash outside brackets
        .replace(/\s*-\s*(?:feat|ft)\.?.*/gi, "")
        // Remove common streaming/YouTube metadata suffixes in brackets only
        .replace(/\s*\[(?:official\s*(?:video|audio|lyric\s*video|music\s*video)|lyrics?|hd|4k|remaster(?:ed)?)\]/gi, "")
        .trim();
  }
  /**
   * @param {Track} track
   * @returns {Object}
   */
  trackToVideo(track) {
    if (!track || typeof track !== "object") return null;
    const i  = track.info ?? {};
    const ms = i.length ?? 0;
    const clean = this.cleanTitle(i.title ?? "Unknown");
    return {
      videoId:    i.identifier ?? "",
      encoded:    track.encoded ?? "",
      sourceName: i.sourceName ?? "unknown",
      title:      clean,
      url:        i.uri ?? `https://www.youtube.com/watch?v=${i.identifier}`,
      thumbnail:  i.artworkUrl ?? null,
      spotifyUrl: null,
      duration: {
        timestamp: Utils.prettifyMS(ms, "h:!m:!s"),
        seconds:   Math.floor(ms / 1000),
      },
      author: {
        name: i.author ?? "Unknown",
        url:  i.uri ?? null,
      },
      artists: null,
    };
  }

  /**
   * @param {string} str
   * @returns {boolean}
   */
  isValidUrl(str) {
    return /https?:\/\/[^\s]+/.test(str);
  }

  async test(query, provider) {
    const node = await this.getNode();
    const res = await node.rest.loadTracks(PROVIDERS[provider].prefix + ":" + query);
    return res.data.map(t => this.trackToVideo(t))[0];
  }

  async getResults(query, limit = 5, provider = "ytm") {
    const id = this.isValidUrl(query) ? query : PROVIDERS[provider].prefix + ":" + query;
    const node = await this.getNode();
    const data = await node.rest.loadTracks(id);

    let tracks = [];
    switch (data.loadType) {
      case "search":
        tracks = data.data ?? [];
        break;
      case "track":
        tracks = [data.data];
        break;
      case "playlist":
        tracks = data.data?.tracks ?? [];
        break;
    }

    return {
      data: tracks.slice(0, limit).map(this.trackToVideo.bind(this))
    };
  }

  /**
   * @typedef MediaData
   * @property {("list"|"video")} type
   * @property {any} data
   */
   /**
    * @param {string} url
    * @returns {Promise<MediaData|boolean>}
    */
  async getUrlData(url) {
    this.emit("message", "⏳ Loading...");
    const node = await this.getNode();
    var data;
    try {
      data = await node.rest.loadTracks(url);
    } catch (e){
      this.emit("error", e.message);
      return false;
    }

    switch (data.loadType) {
      case "playlist":
        const tracks = (data.data?.tracks ?? []).map(this.trackToVideo.bind(this));
        tracks.forEach(t => {
          t.playlistName = data.data?.info?.name ?? null;
        });
        this.emit("message", `✅ Added **${tracks.length}** songs to the queue.`);
        return { type: "list", data: tracks };
      case "track":
        var video = this.trackToVideo(data.data);
        this.emit("message", `✅ Added [${video.title}](${video.url}) to the queue.`);
        return { type: "video", data: video };
      case "search" && !!data.data:
        var video = this.trackToVideo(data.data[0]);
        this.emit("message", `✅ Added [${video.title}](${video.url}) to the queue.`);
        return { type: "video", data: video };
    }

    console.log("Worker exception for url: " + url, data);
    this.emit("message", "❌ Could not load that URL.");
    return false;
  }
  /**
   *
   * @param {string} query
   * @param {string} [provider]
   * @returns {Promise<MediaData|boolean>}
   */
  async getVideoData(query, provider="ytm") {
    if (this.isValidUrl(query)) return this.getUrlData(query);

    this.emit("message", `🔍 Searching ${PROVIDERS[provider].label}...`);
    const node = await this.getNode();
    var data;
    try {
      data = await node.rest.loadTracks(PROVIDERS[provider].prefix + ":" + query);
    } catch (e){
      this.emit("error", e.message);
      return false;
    }

    if (data.loadType === "search" && !!data.data) {
      const video = this.trackToVideo(data.data[0]);
      this.emit("message", `✅ Added [${video.title}](${video.url}) to the queue.`);
      return { type: "video", data: video };
    }

    if (data.loadType === "playlist") {
      const tracks = (data.data?.tracks ?? []).map(this.trackToVideo.bind(this));
      if (tracks.length > 0) {
        this.emit("message", `✅ Added **${tracks.length}** songs to the queue.`);
        return { type: "list", data: tracks };
      }
    }

    this.emit("message", `❌ No results found for '${query}'.`);
    return false;
  }
}

var jobId, data;
if (process.argv[2] === "dev") {
  jobId = "dev";
} else {
  jobId = workerData.jobId;
  data = workerData.data;
}
const utils = new YTUtils();

utils.on("message", (content) => {
  if (jobId === "dev") { console.log("[Message] " + content); return; }
  post("message", content);
});
utils.on("error", (msg) => {
  if (jobId === "dev") { console.log("[Error] " + msg); return; }
  post("error", msg);
});

/**
 *
 * @param {string} event
 * @param {string} data
 * @returns
 */
const post = (event, data) => {
  return parentPort.postMessage(JSON.stringify({ event: event, data: data }));
};

(async () => {
  if (jobId === "dev") {
    console.log(await utils.test("neoni funeral", "ytm"));
    console.log(await utils.getVideoData("https://music.youtube.com/watch?v=Nt7uxzDvH0A", "ytm"));
    console.log(await utils.getVideoData("neoni funeral", "ytm"));
    return;
  }

  var r = null;
  switch (jobId) {
    case "search":
      let result = await utils.getVideoData(data.query, "ytm");
      post("finished", result);
      break;
    case "generalQuery":
      r = await utils.getVideoData(data.query, data.provider);
      post("finished", r);
      break;
    case "searchResults":
      r = await utils.getResults(data.query, data.resultCount, data.provider);
      post("finished", r);
      break;
    default:
      console.log("Invalid jobId");
      process.exit(0);
  }
  process.exit(1);
})().catch(e => {
  console.log("[Worker] Error: ", e);
  try {
    post("error", e?.message ?? String(e))
  } catch (_) { }
  process.exit(1);
});
