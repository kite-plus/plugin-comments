// Puts a comment thread on the page, with the service the site's settings
// name. Kite writes the settings into window.KiteComments before this runs.
(function () {
  "use strict";

  var config = window.KiteComments;
  if (!config) return;
  var settings = config.settings || {};

  var WALINE = "3.15.2";
  var TWIKOO = "2.0.9";
  var KITE_PLUS_EMBED = "https://comments.kite.plus/embed.js";

  var cdns = {
    jsdelivr: function (pkg, version, file) {
      return "https://cdn.jsdelivr.net/npm/" + pkg + "@" + version + "/" + file;
    },
    unpkg: function (pkg, version, file) {
      return "https://unpkg.com/" + pkg + "@" + version + "/" + file;
    },
    npmmirror: function (pkg, version, file) {
      return "https://registry.npmmirror.com/" + pkg + "/" + version + "/files/" + file;
    },
  };
  var cdn = cdns[settings.cdn] || cdns.jsdelivr;

  var local = /^(localhost|127(\.\d+){3}|\[::1\])$/.test(location.hostname);

  function script(src, then) {
    var el = document.createElement("script");
    el.src = src;
    el.onload = then;
    document.head.appendChild(el);
  }

  function stylesheet(href) {
    var el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = href;
    document.head.appendChild(el);
  }

  // Themes mark a dark page in different ways; the system's choice counts
  // when the page says nothing.
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function dark() {
    var root = document.documentElement;
    var said = root.getAttribute("data-theme") || root.getAttribute("data-color-scheme");
    if (said === "dark" || root.classList.contains("dark")) return true;
    if (said === "light" || root.classList.contains("light")) return false;
    return media.matches;
  }
  function onDarkChange(then) {
    var was = dark();
    function check() {
      var now = dark();
      if (now !== was) then((was = now));
    }
    new MutationObserver(check).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-color-scheme", "class"],
    });
    media.addEventListener("change", check);
  }

  // The thread goes where the theme marks, or at the end of the main content.
  function place() {
    var at = document.querySelector("[data-kite-comments]");
    if (at) return at;
    at = document.createElement("section");
    at.className = "kite-comments";
    at.style.marginTop = "3rem";
    var article = document.querySelector("article");
    var main = document.querySelector("main");
    if (main && (!article || main.contains(article))) main.appendChild(at);
    else if (article) article.insertAdjacentElement("afterend", at);
    else document.body.appendChild(at);
    return at;
  }

  var zh = /^zh/i.test(config.lang || "");
  var labels = zh
    ? { repo: "仓库", repo_id: "仓库 ID", category_id: "分类 ID", server: "服务端地址", env: "环境", site: "站点 ID" }
    : { repo: "Repository", repo_id: "Repository ID", category_id: "Category ID", server: "Server address", env: "Environment", site: "Site ID" };

  // missing says, on a preview only, which settings a service still needs:
  // a reader has no use for the note.
  function missing(at, keys) {
    if (!local) return;
    var names = keys.map(function (key) {
      return labels[key];
    });
    var note = document.createElement("p");
    note.style.cssText = "padding:1rem;border:1px dashed currentColor;opacity:.6;font-size:.9em";
    note.textContent = zh
      ? "评论区还不能显示：请在评论插件的设置中填写" + names.join("、") + "。"
      : "The comments cannot show yet: fill in " + names.join(", ") + " in the plugin's settings.";
    at.appendChild(note);
  }

  function giscusLang(lang) {
    lang = (lang || "en").toLowerCase();
    if (/^zh-(tw|hk|mo|hant)/.test(lang)) return "zh-TW";
    if (/^zh/.test(lang)) return "zh-CN";
    return lang.split("-")[0];
  }

  function giscus(at) {
    if (!settings.repo || !settings.repo_id || !settings.category_id) {
      return missing(at, ["repo", "repo_id", "category_id"]);
    }
    var byID = !settings.mapping || settings.mapping === "id";
    var data = {
      repo: settings.repo,
      "repo-id": settings.repo_id,
      category: settings.category,
      "category-id": settings.category_id,
      mapping: byID ? "specific" : settings.mapping,
      term: byID ? config.page : "",
      strict: "0",
      "reactions-enabled": "1",
      "emit-metadata": "0",
      "input-position": "top",
      theme: dark() ? "dark" : "light",
      lang: giscusLang(config.lang),
      loading: "lazy",
    };
    var box = document.createElement("div");
    box.className = "giscus";
    at.appendChild(box);
    var el = document.createElement("script");
    el.src = "https://giscus.app/client.js";
    el.async = true;
    el.crossOrigin = "anonymous";
    for (var key in data) if (data[key]) el.setAttribute("data-" + key, data[key]);
    at.appendChild(el);
    onDarkChange(function (isDark) {
      var frame = at.querySelector("iframe.giscus-frame");
      if (!frame) return;
      frame.contentWindow.postMessage(
        { giscus: { setConfig: { theme: isDark ? "dark" : "light" } } },
        "https://giscus.app"
      );
    });
  }

  function waline(at) {
    if (!settings.server) return missing(at, ["server"]);
    // Waline turns dark while a selector matches, so the page's state is
    // kept in a class of its own.
    var root = document.documentElement;
    root.classList.toggle("kite-comments-dark", dark());
    onDarkChange(function (isDark) {
      root.classList.toggle("kite-comments-dark", isDark);
    });
    var box = document.createElement("div");
    at.appendChild(box);
    stylesheet(cdn("@waline/client", WALINE, "dist/waline.css"));
    script(cdn("@waline/client", WALINE, "dist/waline.umd.js"), function () {
      window.Waline.init({
        el: box,
        serverURL: settings.server,
        path: location.pathname,
        lang: config.lang || "en",
        dark: "html.kite-comments-dark",
      });
    });
  }

  function twikoo(at) {
    if (!settings.env) return missing(at, ["env"]);
    var box = document.createElement("div");
    box.id = "kite-twikoo";
    at.appendChild(box);
    script(cdn("twikoo", TWIKOO, "dist/twikoo.min.js"), function () {
      window.twikoo.init({
        envId: settings.env,
        el: "#kite-twikoo",
        path: location.pathname,
        lang: config.lang || "en",
      });
    });
  }

  var SERIF = /serif|georgia|times|palatino|garamond|charter|iowan|songti|stsong|simsun|mincho|wenkai/i;

  function hex(color) {
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(color || "");
    if (!m || m[4] === "0") return "";
    return "#" + [m[1], m[2], m[3]].map(function (n) {
      return ("0" + Number(n).toString(16)).slice(-2);
    }).join("");
  }

  function luminance(rgb) {
    var lin = rgb.map(function (v) {
      var c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  // The widget draws white text on its accent, so a light link color, as dark
  // themes have, is darkened in the same hue until that text reads (3:1).
  // The browser's untouched default blue says nothing about the theme.
  function usable(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color) || color.toLowerCase() === "#0000ee") return "";
    var rgb = [1, 3, 5].map(function (i) { return parseInt(color.substr(i, 2), 16); });
    while (luminance(rgb) > 0.3) {
      rgb = rgb.map(function (v) { return Math.floor(v * 0.92); });
    }
    return "#" + rgb.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
  }

  // A theme names its accent and font on the spot it marks (data-accent,
  // data-font); otherwise both follow how the page draws its article.
  function looks(at) {
    var named = at.getAttribute("data-accent") || "";
    var accent = /^#[0-9a-f]{6}$/i.test(named) ? named : "";
    var font = at.getAttribute("data-font");
    font = font === "serif" || font === "sans" ? font : "";
    if (!window.getComputedStyle) return { accent: accent, font: font };
    var scope = document.querySelector("article") || document.querySelector("main") || document.body;
    var link = scope.querySelector("a[href]");
    if (!accent && link) accent = usable(hex(window.getComputedStyle(link).color));
    if (!font) {
      var text = scope.querySelector("p") || scope;
      var first = (window.getComputedStyle(text).fontFamily || "").split(",")[0];
      if (SERIF.test(first) && !/sans/i.test(first)) font = "serif";
    }
    return { accent: accent, font: font };
  }

  // The widget follows the page's background and reads its address by itself.
  function kitePlus(at) {
    if (!settings.site) return missing(at, ["site"]);
    var el = document.createElement("kite-comments");
    var look = looks(at);
    var data = {
      site: settings.site,
      "page-key": config.page,
      "page-title": config.title,
      "page-published": config.published,
      lang: config.lang,
      accent: look.accent,
      font: look.font,
    };
    for (var key in data) if (data[key]) el.setAttribute(key, data[key]);
    at.appendChild(el);
    // A theme switch can repaint the links; keep the last usable accent.
    onDarkChange(function () {
      var now = looks(at).accent;
      if (now) el.setAttribute("accent", now);
    });
    if (document.querySelector('script[src="' + KITE_PLUS_EMBED + '"]')) return;
    var tag = document.createElement("script");
    tag.src = KITE_PLUS_EMBED;
    tag.async = true;
    tag.crossOrigin = "anonymous";
    document.head.appendChild(tag);
  }

  function start() {
    var services = { giscus: giscus, waline: waline, twikoo: twikoo, "kite-plus": kitePlus };
    var service = services[settings.provider] || giscus;
    service(place());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
