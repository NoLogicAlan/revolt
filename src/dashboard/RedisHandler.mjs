import { createClient } from "redis";

export class RedisHandler {
  platform = "stoat";
  /**
   *
   * @param {Object} opts
   * @param {RedisClientOptions} opts.redis
   */
  constructor(opts) {
    this.client = createClient(opts.redis);
    this.client.on("error", (err) => {
      console.log("[Redis/Main] Error: ", err);
    });
    this.client.connect().then(() => {
      console.log("[RedisMain] Connected");
      this.readyMessage();
    });

    this.subscriber = this.client.duplicate();
    this.subscriber.on("error", (err) => {
      console.log("[Redis/Subscriber] Error: ", err);
    })
    this.subscriber.connect().then(() => {
      console.log("[Redis/Subscriber] Connected");
      this.subscriber.subscribe("request", async (m) => {
        let payload;
        try {
          payload = JSON.parse(m);
        } catch (e) {
          console.log("[Redis/Subscriber] Invalid JSON in request:", e.message);
          return;
        }
        if (payload.platform !== this.platform) return;
        try {
          const result = await this.handleRequest(payload.content);
          this.send("response", JSON.stringify({
            id: payload.id,
            content: result
          }));
        } catch (e) {
          console.error("[Redis/Subscriber] Error handling request:", e);
          this.send("response", JSON.stringify({
            id: payload.id,
            content: { error: "Internal server error" }
          }));
        }
      });
      this.subscriber.subscribe("info", (m) => {
        let data;
        try {
          data = JSON.parse(m);
        } catch (e) {
          console.log("[Redis/Subscriber] Invalid JSON in info:", e.message);
          return;
        }
        if (data.platform !== "backend") return;
        if (data.type !== "requestConnected") return;
        this.readyMessage();
      });
    });
  }
  readyMessage() {
    this.send("info", JSON.stringify({
      platform: "stoat",
      type: "connected"
    }));
  }
  /**
   *
   * @param {string} channel
   * @param {String} message
   * @returns {Promise<number>}
   */
  send(channel, message) {
    return this.client.publish(channel, message);
  }

  /**
   * @callback RequestCallback
   * @param {Object} data
   * @param {string} data.type
   * @returns {Promise<Object>}
   */
  handleRequest;
  /**
   * @param {RequestCallback} handler
   */
  setRequestHandler(handler) {
    this.handleRequest = handler;
  }
  close() {
    if (this.client) this.client.disconnect();
    if (this.subscriber) this.subscriber.disconnect();
  }
}
