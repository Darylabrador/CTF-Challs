const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const TIMEOUT_MS = parseInt(process.env.PREVIEW_TIMEOUT_MS || "5000", 10);
const MAX_BYTES = parseInt(process.env.MAX_BYTES || "262144", 10);
const MAX_REDIRECTS = parseInt(process.env.MAX_REDIRECTS || "5", 10);

const LOCAL_PROXY_HOST = process.env.LOCAL_PROXY_HOST || "127.0.0.1";
const LOCAL_PROXY_PORT = parseInt(process.env.LOCAL_PROXY_PORT || "8888", 10);

function isBlockedHost(hostname) {
  const blocked = new Set(["internal", "localhost", "127.0.0.1"]);
  if (blocked.has(hostname)) return true;
  if (hostname.endsWith(".internal")) return true;
  return false;
}

async function fetchWithRedirects(startUrl) {
  let current = startUrl;
  let r = null;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const u = new URL(current);

    const common = {
      timeout: TIMEOUT_MS,
      maxRedirects: 0,
      responseType: "arraybuffer",
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      validateStatus: () => true,
      headers: { "User-Agent": "SBK-PreviewBot/1.0", Host: u.host }
    };

    const useLocalProxy = u.protocol === "http:";
    const opts = useLocalProxy
      ? { ...common, proxy: { host: LOCAL_PROXY_HOST, port: LOCAL_PROXY_PORT } }
      : { ...common, proxy: false };

    r = await axios.get(current, opts);

    const loc = r.headers && r.headers.location;
    if (
      loc &&
      [301, 302, 303, 307, 308].includes(r.status) &&
      i < MAX_REDIRECTS
    ) {
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }

  return { r, finalUrl: current };
}

app.get("/auth/continue", (req, res) => {
  const next = req.query.next;
  if (!next) return res.status(400).send("missing next\n");
  return res.redirect(302, next);
});

app.post("/api/preview", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "missing url" });
  }

  let u;
  try {
    u = new URL(url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }

  if (!["http:", "https:"].includes(u.protocol)) {
    return res.status(400).json({ error: "scheme not allowed" });
  }

  if (isBlockedHost(u.hostname)) {
    return res.status(403).json({ error: "host not allowed" });
  }

  try {
    const { r, finalUrl } = await fetchWithRedirects(url);

    const contentType = (r.headers["content-type"] || "").toLowerCase();
    const buf = Buffer.from(r.data || []);
    const text = buf.toString("utf8");

    let title = "";
    let description = "";
    let snippet = "";

    if (contentType.includes("text/html")) {
      const $ = cheerio.load(text);
      title = ($("title").first().text() || "").trim().slice(0, 120);
      description =
        ($('meta[name="description"]').attr("content") ||
          $('meta[property="og:description"]').attr("content") ||
          "").trim().slice(0, 200);
    } else {
      snippet = text.slice(0, 200);
    }

    return res.json({
      requested_url: url,
      final_url: finalUrl,
      status: r.status,
      content_type: contentType,
      title,
      description,
      snippet
    });
  } catch (e) {
    return res.status(500).json({ error: "fetch failed", details: String(e.message || e) });
  }
});

app.listen(8080, () => {
  console.log("web listening on :8080");
});
