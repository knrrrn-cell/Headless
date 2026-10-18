const express = require("express");
const axios = require("axios");
const { addonBuilder, getRouter } = require("stremio-addon-sdk");

const registry = require("./siteler");
const { resolve, why } = require("./domain");
const makeGeneric = require("./generic");

const OZEL = { hdfilmcehennemi: require("./hdfilmcehennemi"), dizigom: require("./dizigom") };
const siteler = registry.map((cfg) => ({ cfg, mod: cfg.custom ? OZEL[cfg.custom] : makeGeneric(cfg) }));

const builder = new addonBuilder({
  id: "benim.eklentim",
  version: "2.0.0",
  name: "Benim Eklentim",
  description: "Seçtiğim sitelerden içerik linkleri",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
});

const metaCache = new Map();
async function getMeta(type, imdbId) {
  const key = `${type}:${imdbId}`;
  if (metaCache.has(key)) return metaCache.get(key);
  const { data } = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, { timeout: 6000 });
  const meta = { ...data.meta, imdb_id: imdbId };
  // İsteğe bağlı: TMDB anahtarı varsa Türkçe başlığı da al (TMDB_KEY ortam değişkeni)
  if (process.env.TMDB_KEY) {
    try {
      const r = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}`, {
        params: { api_key: process.env.TMDB_KEY, external_source: "imdb_id", language: "tr-TR" }, timeout: 5000,
      });
      const x = (r.data.movie_results || [])[0] || (r.data.tv_results || [])[0];
      if (x) meta.trName = x.title || x.name;
    } catch (e) {}
  }
  metaCache.set(key, meta);
  return meta;
}

const SITE_MS = Number(process.env.SITE_MS || 14000);
const BEKLE_MS = Number(process.env.DEADLINE_MS || 14000);
const zamanAsimi = (p, ms = SITE_MS) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("zaman aşımı")), ms))]);

async function siteyiCalistir(s, meta, type, season, episode, dbg) {
  const base = await resolve(s.cfg);
  if (!base) throw new Error("site adresi bulunamadı (" + (why[s.cfg.name] || "?") + ")");
  dbg.push("adres: " + base);
  s.mod.setBase(base);
  return s.mod.ara(meta, type, season, episode, dbg);
}

const streamCache = new Map();

builder.defineStreamHandler(async ({ type, id }) => {
  const c = streamCache.get(id);
  if (c && Date.now() - c.t < 10 * 60 * 1000) return { streams: c.streams };

  const [imdbId, season, episode] = id.split(":");
  let meta;
  try { meta = await getMeta(type, imdbId); } catch (e) { return { streams: [] }; }

  // yetişen sitelerin sonuçlarını topla, en geç BEKLE_MS sonra döndür
  const streams = [];
  const isler = siteler.map((s) =>
    zamanAsimi(siteyiCalistir(s, meta, type, season, episode, []))
      .then((r) => { streams.push(...r); })
      .catch((e) => console.log(`${s.cfg.name} hata:`, e.message))
  );
  await Promise.race([Promise.allSettled(isler), new Promise((r) => setTimeout(r, BEKLE_MS))]);

  if (streams.length) streamCache.set(id, { t: Date.now(), streams: [...streams] });
  return { streams: [...streams] };
});

const app = express();

// Test sayfası: tarayıcıdan /diag/tt22084616  veya  /diag/tt0903747:1:1
app.get("/diag/:id", async (req, res) => {
  const id = req.params.id;
  const [imdbId, season, episode] = id.split(":");
  const type = season ? "series" : "movie";
  let meta;
  try { meta = await getMeta(type, imdbId); } catch (e) { return res.json({ hata: "Cinemeta: " + e.message }); }
  const rapor = await Promise.all(
    siteler.map(async (s) => {
      const t0 = Date.now(), dbg = [];
      try {
        const streams = await zamanAsimi(siteyiCalistir(s, meta, type, season, episode, dbg));
        return { site: s.cfg.name, sonuc: streams.length ? streams[0].externalUrl : "bulunamadı", ms: Date.now() - t0, not: dbg };
      } catch (e) {
        return { site: s.cfg.name, hata: e.message, ms: Date.now() - t0, not: dbg };
      }
    })
  );
  res.json({ film: meta.name, rapor });
});

app.use(getRouter(builder.getInterface()));
app.listen(process.env.PORT || 7000, () => console.log("Eklenti çalışıyor"));
