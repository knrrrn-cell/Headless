// WordPress tarzı film/dizi siteleri için genel modül:
// arar -> sonuç linklerini toplar -> sayfayı açıp IMDb ID / isim+yıl ile doğrular.
const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
};
const get = async (u) => (await axios.get(u, { headers: HEADERS, timeout: 6500, maxRedirects: 5 })).data;

const norm = (s = "") =>
  String(s).toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

const SKIP = /\/(tag|etiket|category|kategori|tur|turler|yil|oyuncu|yonetmen|ulke|page|author|wp-content|wp-json|feed|login|giris|kayit|uye|iletisim|dmca|hakkimizda)(\/|$)/i;

function skor(text, ad) {
  const a = norm(ad).split(" ").filter((w) => w.length > 1);
  const t = " " + norm(text) + " ";
  if (!a.length) return 0;
  return a.filter((w) => t.includes(" " + w + " ")).length / a.length;
}

module.exports = function makeGeneric(cfg) {
  let base = "";
  return {
    name: cfg.name,
    setBase(b) { base = b.replace(/\/$/, ""); },

    async ara(meta, type, season, episode, dbg = []) {
      const q = meta.name;
      const yil = (String(meta.releaseInfo || meta.year || "").match(/\d{4}/) || [])[0];
      const host = new URL(base).hostname.replace(/^www\./, "");

      // 1) arama
      let html = "";
      const sablonlar = cfg.search || ["/?s={q}"];
      const adaylar = new Map();
      for (const sb of sablonlar) {
        const url = base + sb.replace("{q}", encodeURIComponent(q));
        try { html = await get(url); } catch (e) { dbg.push("arama hatası: " + (e.response ? "HTTP " + e.response.status : e.message)); continue; }
        const $ = cheerio.load(html);
        $("a[href]").each((_, a) => {
          let u;
          try { u = new URL($(a).attr("href"), base); } catch (e) { return; }
          if (u.hostname.replace(/^www\./, "") !== host) return;
          if (u.pathname.length < 2 || SKIP.test(u.pathname) || u.search.includes("s=")) return;
          const metin = $(a).text() + " " + ($(a).find("img").attr("alt") || "") + " " + ($(a).attr("title") || "");
          const key = u.origin + u.pathname;
          const s = skor(metin, q) + ($(a).find("img").length ? 0.2 : 0);
          if (!adaylar.has(key) || adaylar.get(key).s < s) adaylar.set(key, { url: key, s, metin: metin.trim().slice(0, 60) });
        });
        if (adaylar.size) break;
      }
      const sirali = [...adaylar.values()].sort((a, b) => b.s - a.s).slice(0, 4);
      dbg.push(`aday: ${adaylar.size}, bakılan: ${sirali.length}`);
      if (!sirali.length) return [];

      // 2) doğrulama: sayfada IMDb ID ya da (isim + yıl) var mı
      const sonuc = await Promise.all(
        sirali.map(async (c) => {
          try {
            const sayfa = await get(c.url);
            const imdb = sayfa.includes(meta.imdb_id);
            const $ = cheerio.load(sayfa);
            const baslik = $("meta[property='og:title']").attr("content") || $("title").text();
            const adTut = norm(baslik).includes(norm(q)) && (!yil || sayfa.includes(yil));
            return imdb || adTut ? { ...c, imdb, baslik } : null;
          } catch (e) { return null; }
        })
      );
      const hit = sonuc.filter(Boolean).sort((a, b) => (b.imdb ? 1 : 0) - (a.imdb ? 1 : 0))[0];
      if (!hit) { dbg.push("doğrulanan sayfa yok"); return []; }
      dbg.push(`eşleşti: ${hit.url} (${hit.imdb ? "IMDb" : "isim+yıl"})`);

      // 3) dizide bölüm adresi bilinmiyor: dizi sayfasını aç
      return [{
        name: cfg.name,
        title: type === "series" ? `S${season}E${episode} · dizi sayfası` : "Film sayfası",
        externalUrl: hit.url,
      }];
    },
  };
};
