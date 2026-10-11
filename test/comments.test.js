// Runs assets/comments.js against a small fake page. Needs Node 20 or later
// and nothing else: node --test test/comments.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "assets", "comments.js"), "utf8");
const EMBED = "https://comments.kite.plus/embed.js";

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.parent = null;
    this.style = {};
    this.className = "";
    this.textContent = "";
    this.classList = { contains: () => false, toggle() {} };
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }
  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }
  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  contains(other) {
    for (let node = other; node; node = node.parent) if (node === this) return true;
    return false;
  }
  insertAdjacentElement(where, el) {
    assert.equal(where, "afterend");
    el.parent = this.parent;
    this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, el);
    return el;
  }
  // Understands what the script asks for: tag, [attr] and [attr="value"].
  matches(selector) {
    const m = /^([a-z-]*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(selector);
    assert.ok(m, "selector not supported by the fake page: " + selector);
    const [, tag, attr, value] = m;
    if (tag && this.tag !== tag) return false;
    if (!attr) return true;
    const have = attr in this.attrs ? this.attrs[attr] : this[attr];
    return value === undefined ? have !== undefined : have === value;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  find(selector) {
    return this.matches(selector) ? this : this.querySelector(selector);
  }
}

// run loads the script into a fresh page and hands the page back.
function run(config, { hostname = "blog.example.com", main = true, marker = false, loaded = false } = {}) {
  const html = new Element("html");
  const head = new Element("head");
  const body = new Element("body");
  html.appendChild(head);
  html.appendChild(body);
  html.getAttribute = () => null;
  const mainEl = main ? body.appendChild(new Element("main")) : null;
  const slot = marker ? body.appendChild(new Element("div")) : null;
  if (slot) slot.attrs["data-kite-comments"] = "";
  if (loaded) {
    const tag = head.appendChild(new Element("script"));
    tag.src = EMBED;
  }

  const document = {
    readyState: "complete",
    documentElement: html,
    head,
    body,
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => html.querySelector(selector),
    addEventListener() {},
  };
  const sandbox = {
    document,
    location: { hostname },
    MutationObserver: class {
      observe() {}
    },
    KiteComments: config,
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = () => ({ matches: false, addEventListener() {} });
  vm.runInNewContext(source, sandbox);
  return { head, body, main: mainEl, slot, widgets: () => collect(html, (el) => el.tag === "kite-comments"), scripts: () => collect(html, (el) => el.tag === "script") };
}

function collect(root, want, out = []) {
  for (const child of root.children) {
    if (want(child)) out.push(child);
    collect(child, want, out);
  }
  return out;
}

const post = {
  settings: { provider: "kite-plus", site: "s-123" },
  page: "01J8KQ2P3R4S5T6V7W8X9YZ000",
  title: "Hello",
  published: "2026-01-01T00:30:00Z",
  lang: "en",
};

test("kite plus: puts the widget at the end of the main content", () => {
  const page = run(post);
  const [widget] = page.widgets();
  assert.equal(page.widgets().length, 1);
  assert.deepEqual(widget.attrs, {
    site: "s-123",
    "page-key": "01J8KQ2P3R4S5T6V7W8X9YZ000",
    "page-title": "Hello",
    "page-published": "2026-01-01T00:30:00Z",
    lang: "en",
  });
  assert.equal(widget.parent.className, "kite-comments");
  assert.equal(page.main.children[0], widget.parent);
});

test("kite plus: fills the spot a theme marks", () => {
  const page = run(post, { marker: true });
  assert.equal(page.widgets()[0].parent, page.slot);
  assert.equal(page.main.children.length, 0);
});

test("kite plus: loads embed.js once, without cookies", () => {
  const page = run(post);
  const embeds = page.scripts().filter((el) => el.src === EMBED);
  assert.equal(embeds.length, 1);
  assert.equal(embeds[0].async, true);
  assert.equal(embeds[0].crossOrigin, "anonymous");
});

test("kite plus: leaves embed.js alone when the page loads it already", () => {
  const page = run(post, { loaded: true });
  assert.equal(page.scripts().filter((el) => el.src === EMBED).length, 1);
  assert.equal(page.widgets().length, 1);
});

test("kite plus: leaves out what the page does not have", () => {
  const page = run({ settings: post.settings, page: "", title: "", published: null });
  assert.deepEqual(page.widgets()[0].attrs, { site: "s-123" });
});

test("kite plus: asks for nothing without a site", () => {
  for (const hostname of ["blog.example.com", "localhost"]) {
    const page = run({ ...post, settings: { provider: "kite-plus", site: "" } }, { hostname });
    assert.equal(page.widgets().length, 0);
    assert.equal(page.scripts().length, 0);
  }
});

test("a preview says which setting is missing, a reader sees nothing", () => {
  const cases = [
    ["giscus", "Repository"],
    ["waline", "Server address"],
    ["twikoo", "Environment"],
    ["kite-plus", "Site ID"],
  ];
  for (const [provider, name] of cases) {
    const config = { settings: { provider }, page: "x", lang: "en" };
    const preview = run(config, { hostname: "localhost" });
    const note = preview.main.querySelector("p");
    assert.ok(note && note.textContent.includes(name), provider + " should name " + name);
    assert.equal(run(config).main.querySelector("p"), null, provider + " should stay quiet for readers");
  }
});

test("the hint is in Chinese on a Chinese site", () => {
  const config = { settings: { provider: "kite-plus" }, page: "x", lang: "zh-CN" };
  const note = run(config, { hostname: "localhost" }).main.querySelector("p");
  assert.ok(note.textContent.includes("站点 ID"));
});

test("a site with no provider still gets Giscus", () => {
  const page = run({
    settings: { repo: "o/r", repo_id: "R_1", category_id: "DIC_1" },
    page: "x",
    lang: "en",
  });
  assert.ok(page.scripts().some((el) => el.src === "https://giscus.app/client.js"));
  assert.equal(page.widgets().length, 0);
});
