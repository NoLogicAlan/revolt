import RevoltBots from "revoltbots.js";

export class RBL {
  remix;
  api;
  _serverCreateHandler = null;
  _serverDeleteHandler = null;
  constructor(remix) {
    if (!remix.config.rbl.token) {
      console.log("No rbl config found. Disabling stats updates.");
      return this;
    }
    this.api = new RevoltBots.Client(remix.config.rbl.token);
    this.remix = remix;

    remix.client.once("ready", () => {
      this.post();
    });
    this._serverCreateHandler = () => {
      this.post();
    };
    this._serverDeleteHandler = () => {
      this.post();
    };
    remix.client.on("serverCreate", this._serverCreateHandler);
    remix.client.on("serverDelete", this._serverDeleteHandler);
  }
  cleanup() {
    if (this._serverCreateHandler) this.remix.client.removeListener("serverCreate", this._serverCreateHandler);
    if (this._serverDeleteHandler) this.remix.client.removeListener("serverDelete", this._serverDeleteHandler);
  }
  post() {
    this.api.postStats(this.remix.client).then(result => {
      if (result.message !== "Successfully updated.") console.log(result);
    }).catch(e => {
      console.error("[RBL] Error posting stats:", e);
    });
  }
}
