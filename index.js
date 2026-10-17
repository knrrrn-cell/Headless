const express = require("express");
const axios = require("axios");
const { addonBuilder, getRouter } = require("stremio-addon-sdk");

const registry = require("./siteler");
const { resolve } = require("./domain");
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
  metaCache.set(key, meta);
  return meta;
}

const zamanAsimi = (p, ms = 12000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("zaman aşımı")), ms))]);

async function siteyiCalistir(s, meta, type, season, episode, dbg) {
  const base = await resolve(s.cfg);
  if (!base) throw new Error("site adresi bulunamadı");
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

  const sonuclar = await Promise.allSettled(
    siteler.map((s) => zamanAsimi(siteyiCalistir(s, meta, type, season, episode, [])))
  );
  const streams = [];
  sonuclar.forEach((r, i) => {
    if (r.status === "fulfilled") streams.push(...r.value);
    else console.log(`${siteler[i].cfg.name} hata:`, r.reason && r.reason.message);
  });

  streamCache.set(id, { t: Date.now(), streams });
  return { streams };
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
