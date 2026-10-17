const axios = require("axios");
const cheerio = require("cheerio");

let BASE = "https://www.hdfilmcehennemi.nl";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  "X-Requested-With": "fetch",
  "Content-Type": "application/json",
};

const abs = (href) => (href.startsWith("http") ? href : BASE + href);

// /search?q=tt22084616 -> { query, results: ["<a ...>", ...] }
async function ara(imdbId) {
  const { data } = await axios.get(`${BASE}/search?q=${encodeURIComponent(imdbId)}`, {
    headers: HEADERS,
    timeout: 8000,
  });
  const sonuc = [];
  for (const html of data.results || []) {
    const $ = cheerio.load(html);
    // kart: <a class="search-result" href="..."> <img alt="başlık"> ... <span class="year">
    const a = $("a.search-result").first();
    const href = a.attr("href");
    if (!href) continue;
    sonuc.push({
      url: abs(href),
      title: a.find("img").attr("alt") || "",
      year: parseInt(a.find(".year").text(), 10) || null,
    });
  }
  return sonuc;
}

module.exports = {
  setBase(b) { BASE = b.replace(/\/$/, ""); },
  name: "HDFilmCehennemi",
  async ara(meta, type, season, episode) {
    const imdbId = meta.imdb_id || meta.id;
    const sonuc = await ara(imdbId);
    if (!sonuc.length) return [];

    if (type === "series") {
      const dizi = sonuc.find((r) => r.url.includes("/dizi/"));
      if (!dizi) return [];
      const base = dizi.url.replace(/\/$/, "");
      return [
        {
          name: "HDFilmCehennemi",
          title: `S${season}E${episode} (tarayıcıda açılır)`,
          externalUrl: `${base}/sezon-${season}/bolum-${episode}/`,
        },
      ];
    }

    const film = sonuc.find((r) => !r.url.includes("/dizi/"));
    if (!film) return [];
    return [
      {
        name: "HDFilmCehennemi",
        title: "Film sayfası (tarayıcıda açılır)",
        externalUrl: film.url,
      },
    ];
  },
};
