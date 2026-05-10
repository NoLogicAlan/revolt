import { https } from "follow-redirects";

export class Tuna {
  apiKey = null;
  constructor(auth) {
    this.apiKey = auth.key;
  }
  get(path, params={}) {
    return new Promise((resolve, rej) => {
      // Build query string properly
      const entries = Object.entries(params);
      const query = entries.length > 0
        ? "?" + entries.map(([key, val]) => key + "=" + encodeURIComponent(val)).join("&")
        : "";
      var options = {
        'method': 'GET',
        'hostname': 'tuna-api.voicemod.net',
        'path': path + query,
        'headers': {
          'x-api-key': this.apiKey
        },
        'maxRedirects': 20,
        'timeout': 15000
      };
      var req = https.request(options, function (res) {
        var chunks = [];

        res.on("data", function (chunk) {
          chunks.push(chunk);
        });

        res.on("end", function (_chunk) {
          var body = Buffer.concat(chunks);
          try {
            resolve(JSON.parse(body.toString()));
          } catch (e) {
            rej(new Error("Tuna API returned invalid JSON: " + e.message));
          }
        });

        res.on("error", function (error) {
          rej(error);
        });
      });

      req.on("timeout", () => {
        req.destroy();
        rej(new Error("Tuna API request timed out after 15 seconds"));
      });
      req.on("error", function (error) {
        rej(error);
      });
      req.end();
    });
  }

  search(query, page=1, size=10) {
    return this.get("/v1/sounds/search", {size, page, search: query}).then(results => {
      if (results.items) {
        results.items = results.items.map(s => {
          s.download = () => this._download(s.oggPath);
          return s;
        });
      }
      return results;
    });
  }
  getSound(id) {
    return this.get("/v1/sounds/" + id).then(sound => {
      sound.download = () => this._download(sound.oggPath);
      return sound;
    });
  }
  /**
   * Downloads a Tuna sound file, returning the HTTP response stream.
   * The response is auto-destroyed after 30 seconds or when piped and ended.
   * @param {string} oggPath
   * @returns {Promise<import("http").IncomingMessage>}
   */
  _download(oggPath) {
    return new Promise((resolve, reject) => {
      const req = https.get(oggPath, (r) => {
        // Auto-destroy the response if not consumed within 30 seconds
        const timeout = setTimeout(() => {
          if (!r.destroyed) r.destroy();
          reject(new Error("Tuna download timed out"));
        }, 30000);
        r.on("end", () => clearTimeout(timeout));
        r.on("error", (err) => { clearTimeout(timeout); reject(err); });
        // Wrap pipe to auto-destroy on end
        const originalPipe = r.pipe.bind(r);
        r.pipe = function(dest, opts) {
          r.on("end", () => {
            clearTimeout(timeout);
            if (!r.destroyed) r.destroy();
          });
          return originalPipe(dest, opts);
        };
        resolve(r);
      });
      req.on("error", (err) => reject(err));
    });
  }
}
