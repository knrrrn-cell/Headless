const axios = require("axios");
const cheerio = require("cheerio");

let BASE = "https://www.dizigom.news";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
};

const get = async (url) =>
  (await axios.get(url, { headers: HEADERS, timeout: 8000 })).data;

const norm = (s = "") =>
  s
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// JSON-LD bloklarını düzleştirip döndürür
function jsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).contents().text());
      (j["@graph"] || [j]).forEach((x) => out.push(x));
    } catch (e) {}
  });
  return out;
}

// /ara?q= sonuçlarından film ve dizi kartlarını çıkarır
async function ara(isim) {
  const $ = cheerio.load(await get(`${BASE}/ara?q=${encodeURIComponent(isim)}`));
  const seen = new Set();
  const list = [];
  $("a.group.block").each((_, a) => {
    const href = $(a).attr("href") || "";
    const title = $(a).find("h3").first().text().trim();
    if (!title || seen.has(href)) return;
    const isFilm = href.includes("/film/");
    const isDizi = href.includes("/diziler/");
    if (!isFilm && !isDizi) return;
    seen.add(href);
    list.push({
      url: href,
      title,
      year: parseInt($(a).find("p").first().text(), 10) || null,
      type: isFilm ? "movie" : "series",
    });
  });
  return list;
}

// Cinemeta meta'sına karşılık gelen sayfayı bulur
async function esles(meta, type) {
  const sonuc = (await ara(meta.name)).filter((r) => r.type === type);
  const ad = norm(meta.name);
  const yil = parseInt(meta.year || meta.releaseInfo, 10) || null;

  if (type === "series") {
    return sonuc.find((r) => norm(r.title) === ad) || null;
  }
  // film: önce başlık, sonra yıl + detay sayfasındaki alternateName
  const direkt = sonuc.find((r) => norm(r.title) === ad && (!yil || r.year === yil));
  if (direkt) return direkt;
  for (const r of sonuc.filter((r) => !yil || r.year === yil)) {
    try {
      const $ = cheerio.load(await get(r.url));
      const film = jsonLd($).find((x) => x["@type"] === "Movie");
      if (film && norm(film.alternateName || film.name) === ad) return r;
    } catch (e) {}
  }
  return null;
}

// Sayfadaki oynatıcı iframe adresini döndürür (yoksa null)
async function embedBul(sayfaUrl) {
  const $ = cheerio.load(await get(sayfaUrl));
  let src = $("iframe[data-player-frame]").attr("src");
  if (!src) {
    const v = jsonLd($).find((x) => x["@type"] === "VideoObject");
    src = v && v.embedUrl;
  }
  return src || null; // film sayfasında sadece fragman varsa null döner
}

// TODO: embed sayfasından m3u8/mp4 çıkaracak kısım (örnek kaynak lazım)
async function cozumle(embedUrl) {
  return { externalUrl: embedUrl };
}

module.exports = {
  setBase(b) { BASE = b.replace(/\/$/, ""); },
  name: "Dizigom",
  async ara(meta, type, season, episode) {
    const hit = await esles(meta, type);
    if (!hit) return [];

    let sayfa = hit.url;
    if (type === "series") {
      const slug = hit.url.split("/diziler/")[1].replace(/\/$/, "");
      sayfa = `${BASE}/${slug}-${season}-sezon-${episode}-bolum/`;
    }

    const embed = await embedBul(sayfa);
    if (!embed) return [];
    // embed alan kilitli, o yüzden sitenin kendi sayfasını açtırıyoruz
    return [{ name: "Dizigom", title: hit.title, externalUrl: sayfa }];
  },
};
