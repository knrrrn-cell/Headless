// Site adresini bulur. Eski adres çalışmazsa numarayı artırarak dener,
// bulduğunu dosyaya kaydeder ve oradan aramaya devam eder.
const axios = require("axios");
const fs = require("fs");

const FILE = process.env.DOMAIN_FILE || "/tmp/domains.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

let disk = {};
try { disk = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) {}
const save = () => { try { fs.writeFileSync(FILE, JSON.stringify(disk)); } catch (e) {} };

const memo = {}; // ad -> { base, t }
const TTL = 10 * 60 * 1000;

// Adres çalışıyor mu? Yönlendirme varsa son adresi (origin) döndürür.
async function probe(base, verify) {
  try {
    const r = await axios.get(base, {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const html = typeof r.data === "string" ? r.data : "";
    if (verify && !verify.test(html)) return null;
    const final = (r.request && r.request.res && r.request.res.responseUrl) || base;
    return new URL(final).origin;
  } catch (e) {
    return null;
  }
}

function found(site, base) {
  if (disk[site.name] !== base) { disk[site.name] = base; save(); }
  memo[site.name] = { base, t: Date.now() };
  return base;
}

async function resolve(site) {
  const m = memo[site.name];
  if (m && Date.now() - m.t < TTL) return m.base;

  const tried = new Set();
  const known = [disk[site.name], ...(site.bases || [])].filter(Boolean);
  for (const b of known) {
    if (tried.has(b)) continue;
    tried.add(b);
    const p = await probe(b, site.verify);
    if (p) return found(site, p);
  }

  if (site.pattern) {
    const { prefix, suffix = "", start, tries = 40, batch = 6 } = site.pattern;
    const saved = disk[site.name];
    const num = saved && saved.startsWith(prefix) ? parseInt(saved.slice(prefix.length), 10) : 0;
    const from = Math.max(start, num || 0);
    const list = [];
    for (let n = from; n <= from + tries; n++) list.push(prefix + n + suffix);
    for (let i = 0; i < list.length; i += batch) {
      const part = list.slice(i, i + batch).filter((u) => !tried.has(u));
      const res = await Promise.all(part.map((u) => probe(u, site.verify)));
      const hit = res.find(Boolean); // numarası en küçük çalışan
      if (hit) return found(site, hit);
    }
  }

  // bulunamadı: 2 dk sonra tekrar denesin
  memo[site.name] = { base: null, t: Date.now() - (TTL - 2 * 60 * 1000) };
  return null;
}

module.exports = { resolve };
