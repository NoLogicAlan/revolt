import { createClient } from "redis";

export class RedisHandler {
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
    });

    this.subscriber = this.client.duplicate();
    this.subscriber.on("error", (err) => {
      console.log("[Redis/Subscriber] Error: ", err);
    })
    this.subscriber.connect().then(() => {
      console.log("[Redis/Subscriber] Connected");
      this.subscriber.subscribe("request", async (m) => {
        const payload = JSON.parse(m);
        const result = await this.handleRequest(payload.content);
        this.send("response", JSON.stringify({
          id: payload.id,
          content: result
        }));
      });
    });
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
}
