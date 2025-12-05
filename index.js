import express from "express";
import axios from "axios";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(morgan("dev"));

const PORT = process.env.PORT || 3000;
const VIMEO_TOKEN = process.env.VIMEO_TOKEN;

app.get("/", (req, res) => {
  res.send("Connected to Engine Service");
});

app.get("/proxy/:videoId/master.m3u8", async (req, res) => {
  const videoId = req.params.videoId;

  try {
    const configUrl = `https://player.vimeo.com/video/${videoId}/config`;
    const { data } = await axios.get(configUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const hls = data?.request?.files?.hls;
    if (!hls) return res.status(404).send("No HLS found in config");

    const cdns = data?.request?.files?.hls?.cdns;
    const firstCdn = cdns[data.request.files.hls.default_cdn];
    const originalUrl = firstCdn.url;

    if (!originalUrl) return res.status(404).send("Missing HLS URL");

    const manifestRes = await axios.get(originalUrl, {
      responseType: "text",
      maxRedirects: 5,
    });

    const manifest = manifestRes.data;
    const baseUrl = originalUrl.replace("playlist.m3u8", "");

    const proxied = manifest.replace(
      /(.+\.ts)/g,
      `${req.protocol}://${req.get("host")}/segment/${videoId}/$1`
    );

    res.set("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(proxied);
  } catch (e) {
    console.log(e.message);
    res.status(500).send("Error fetching manifest");
  }
});

app.get("/segment/:videoId/:segment", async (req, res) => {
  const { videoId, segment } = req.params;

  try {
    const configUrl = `https://player.vimeo.com/video/${videoId}/config`;
    const { data } = await axios.get(configUrl);

    const hls = data.request.files.hls;
    const cdn = hls.cdns[hls.default_cdn];
    const baseUrl = cdn.url.replace("playlist.m3u8", "");

    const segmentUrl = baseUrl + segment;

    const stream = await axios.get(segmentUrl, {
      responseType: "arraybuffer",
    });

    res.set("Content-Type", "video/mp2t");
    res.send(stream.data);
  } catch (err) {
    console.log(err.message);
    res.status(500).send("Failed to fetch TS segment");
  }
});

app.listen(PORT, () => {
  console.log(`Vimeo Proxy running on http://localhost:${PORT}`);
});
