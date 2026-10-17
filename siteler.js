// Tüm siteler burada. Adres değişince sadece bu dosyayı düzenle.
//  bases   : bilinen adresler (sırayla denenir)
//  pattern : adres numarayla artıyorsa (dizipal1590 -> 1591 -> ...)
//  verify  : doğru siteye geldiğini anlamak için sayfada aranacak kalıp
//  search  : arama adresi şablonu ({q} = aranan isim). Varsayılan WordPress: /?s={q}
//  custom  : özel yazılmış modül adı (hdfilmcehennemi, dizigom)
module.exports = [
  { name: "HDFilmCehennemi", custom: "hdfilmcehennemi", bases: ["https://www.hdfilmcehennemi.nl"], verify: /hdfilmcehennemi/i },
  { name: "Dizigom", custom: "dizigom", bases: ["https://www.dizigom.icu", "https://www.dizigom.news"], verify: /dizigom/i },

  { name: "Dizipal", bases: ["https://dizipal1590.com"],
    pattern: { prefix: "https://dizipal", suffix: ".com", start: 1590, tries: 40 }, verify: /dizipal/i },
  { name: "Dizipal 2", bases: ["https://dizipal2140.com"],
    pattern: { prefix: "https://dizipal", suffix: ".com", start: 2140, tries: 40 }, verify: /dizipal/i },

  { name: "ÇizgiVeDizi", bases: ["https://cizgivedizi.net"] },
  { name: "Çizgimax", bases: ["https://cizgimax.online"] },
  { name: "Hdfilmizle", bases: ["https://www.hdfilmizle.live"] },
  { name: "Animecix", bases: ["https://animecix.tv"] },        // büyük ihtimalle JS tabanlı, genel modül tutmayabilir
  { name: "Anizm", bases: ["https://anizm.net"] },
  { name: "Filmmakinesi", bases: ["https://filmmakinesi.to"] },
  { name: "HDToday", bases: ["https://hdtoday24.at"] },         // İngilizce site, farklı yapıda olabilir
  { name: "FullHDFilmizlesene", bases: ["https://www.fullhdfilmizlesene.now"] },
  { name: "Ufilmizle", bases: ["https://ufilmizle.com"] },
  { name: "Filmdozu", bases: ["https://filmdozu.website"] },
  { name: "Hdfilmdelisi", bases: ["https://hdfilmdelisi.one"] },
  { name: "Filmgecesi", bases: ["https://www.filmgecesi.vip"] },
  { name: "Filmizlefilmizle", bases: ["https://filmizlefilmizle.com"] },
  { name: "Pcfilmizle", bases: ["https://pcfilmizle.com"] },
  { name: "Diziboxizle", bases: ["https://diziboxizle.com"] },
  { name: "Filmekseni", bases: ["https://filmekseni.vip"] },
  { name: "Kultfilmler", bases: ["https://kultfilmler.net"] },
];
