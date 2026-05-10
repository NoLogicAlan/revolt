import ffprobe from "ffprobe-static";
import { spawn } from "node:child_process";

export default function(file) {
  return new Promise((res, rej) => {
    // Pass arguments as an array to properly handle paths with spaces
    const args = [
      "-hide_banner",
      "-show_entries", "format_tags:format=duration",
      "-print_format", "json",
      "-i", file
    ];

    const proc = spawn(ffprobe.path, args);
    const chunks = [];
    const timeout = setTimeout(() => {
      proc.kill();
      rej(new Error("ffprobe timed out after 10 seconds"));
    }, 10000);
    proc.stdout.on("data", (d) => {
      chunks.push(d);
    });
    proc.stderr.on("data", () => {}); // drain stderr to prevent process hang
    proc.stdout.on("end", () => {
      clearTimeout(timeout);
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString());
        res({
          album: data.format?.tags?.album,
          artist: data.format?.tags?.artist,
          title: data.format?.tags?.title || data.format?.tags?.StreamTitle,
          duration: data.format.duration * 1000 // convert to ms
        });
      } catch (e) {
        rej(new Error("ffprobe returned invalid JSON: " + e.message));
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      rej(err);
    });
  });
}
