export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only allow GET requests everywhere
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // API route
    if (url.pathname === "/goodreads-shelf") {
      return handleShelf(url);
    }

    // UI route (everything else)
    return withSecureHeaders(
      new Response(INDEX_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  },
};

// ----- Security helpers -----
function withSecureHeaders(resp) {
  const h = new Headers(resp.headers);
  h.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'unsafe-inline' 'self'",
      "connect-src 'self' https://www.goodreads.com https://*.workers.dev",
      "img-src 'self' data:",
      "navigate-to 'self' https://www.goodreads.com",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  h.set("Referrer-Policy", "no-referrer");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Content-Type": "application/json",
    },
  });
}

// ----- API handler -----
async function handleShelf(url) {
  const userId = (url.searchParams.get("user_id") || "").trim();
  const shelf = (url.searchParams.get("shelf") || "to-read").trim();
  const perPage = clampInt(url.searchParams.get("per_page"), 1, 200, 200);
  const page = clampInt(url.searchParams.get("page"), 1, 5, 1);

  // Only numeric Goodreads IDs
  if (!/^[0-9]{1,20}$/.test(userId)) {
    return json({ error: "Invalid user_id" }, 400);
  }

  const rss = `https://www.goodreads.com/review/list_rss/${encodeURIComponent(
    userId
  )}?shelf=${encodeURIComponent(shelf)}&per_page=${perPage}&page=${page}`;

  try {
    const upstream = await fetch(rss, {
      headers: { "User-Agent": "goodreads-random-picker" },
    });

    if (!upstream.ok) {
      return json({ error: "Upstream error", status: upstream.status }, upstream.status);
    }

    const xml = await upstream.text();
    if (xml.length > 2_000_000) {
      return json({ error: "Response too large" }, 502);
    }

    const books = parseGoodreadsRSS(xml);
    return json({ books });
  } catch {
    return json({ error: "Failed to fetch or parse RSS" }, 500);
  }
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return fallback;
}

// ----- Minimal RSS parser for Goodreads -----
function parseGoodreadsRSS(xml) {
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map((m) => m[1]);
  const get = (s, tag) => {
    const m = s.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? decode(m[1]) : "";
  };

  return items
    .map((it) => {
      const title = stripToReadPrefix(get(it, "title"));
      const author = get(it, "author_name");
      const rawLink = get(it, "link");
      const link = normalizeGoodreadsLink(rawLink, title, author);
      return { title, author, link };
    })
    .filter((b) => b.title);
}

function stripToReadPrefix(s) {
  return s.replace(/^\s*to-read:\s*/i, "").trim();
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Ensure we navigate to a clean HTTPS Goodreads URL.
// If the feed link is missing or odd, fall back to a Goodreads search URL.
function normalizeGoodreadsLink(u, title, author) {
  const query = encodeURIComponent([title || "", author || ""].join(" ").trim());
  const fallback = `https://www.goodreads.com/search?q=${query}`;

  if (!u) return fallback;

  let s = decode(u).trim();

  // Force https
  s = s.replace(/^http:\/\//i, "https://");

  // If it doesn't look like Goodreads, fall back to search
  try {
    const parsed = new URL(s);
    if (!/\.goodreads\.com$/i.test(parsed.hostname)) return fallback;
  } catch {
    return fallback;
  }

  return s;
}

// ----- Single-file HTML UI -----
const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Goodreads Random Book Picker</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: #f7f7f7; color: #111; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
  .row { display: flex; gap: 12px; align-items: center; }
  .grid { display: grid; gap: 12px; }
  h1 { font-size: 22px; margin: 0 0 12px; text-align: center; }
  label { font-size: 14px; color: #555; }
  input, button { font-size: 15px; padding: 10px 12px; border-radius: 10px; border: 1px solid #ddd; }
  input { width: 100%; }
  button { background: #111; color: #fff; border: none; cursor: pointer; }
  button.secondary { background: #1a7f37; }
  button:disabled { opacity: .5; cursor: default; }
  .hint { font-size: 12px; color: #666; }
  .status { font-size: 12px; color: #666; }
  .book { border: 1px solid #eee; border-radius: 14px; padding: 14px; }
  .link { color: #3355ee; text-decoration: underline; }
</style>
</head>
<body>
  <div class="wrap grid">
    <div class="card grid">
      <h1>Goodreads Random Book Picker</h1>

      <div class="grid">
        <label>Your Goodreads numeric user id</label>
        <div class="row">
          <input id="userId" placeholder="e.g. 137464693" />
          <button id="load" class="secondary">Load and pick</button>
        </div>
        <div class="status" id="status"></div>
      </div>
      <div class="hint">Enter your numerical Goodreads ID and click "Load and Pick" to have a random book from your Want-to-read shelf picked for you</div>

      <div class="grid">
        <label>Filter</label>
        <input id="filter" placeholder="Filter by title or author" />
      </div>

      <div class="row">
        <button id="pick">Pick for me</button>
      </div>

      <div class="book grid" id="book" style="display:none">
        <div id="btitle" style="font-weight:600"></div>
        <div id="bauthor" style="color:#444"></div>
        <a id="blink" class="link" href="#" target="_blank" rel="noopener noreferrer">Open on Goodreads</a>
      </div>
    </div>
  </div>

  <script>
    const userIdInput = document.getElementById("userId");
    const loadBtn = document.getElementById("load");
    const filterInput = document.getElementById("filter");
    const pickBtn = document.getElementById("pick");
    const statusEl = document.getElementById("status");
    const bookCard = document.getElementById("book");
    const btitle = document.getElementById("btitle");
    const bauthor = document.getElementById("bauthor");
    const blink = document.getElementById("blink");

    let books = [];

    function filtered() {
      const q = filterInput.value.trim().toLowerCase();
      if (!q) return books;
      return books.filter(b => (b.title + " " + b.author).toLowerCase().includes(q));
    }

    function showPick(b) {
      if (!b) return;
      btitle.textContent = b.title;
      bauthor.textContent = b.author || "";
      if (b.link) {
        blink.href = b.link;
        blink.style.display = "inline";
      } else {
        blink.removeAttribute("href");
        blink.style.display = "none";
      }
      bookCard.style.display = "grid";
    }

    pickBtn.onclick = () => {
      const pool = filtered();
      if (!pool.length) return;
      const i = Math.floor(Math.random() * pool.length);
      showPick(pool[i]);
    };

    async function loadShelf() {
      const userId = (userIdInput.value || "").trim();
      if (!userId) { statusEl.textContent = "Enter your Goodreads numeric user id"; return; }
      statusEl.textContent = "Loading shelf";
      bookCard.style.display = "none";

      try {
        const url = "/goodreads-shelf?user_id=" + encodeURIComponent(userId) + "&shelf=to-read&per_page=200";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed " + res.status);
        const data = await res.json();
        books = data.books || [];
        statusEl.textContent = books.length ? "Loaded " + books.length + " books" : "No books found";
        if (books.length) pickBtn.click();
      } catch (e) {
        statusEl.textContent = "Could not load shelf";
      }
    }

    loadBtn.onclick = loadShelf;
    window.addEventListener("load", () => userIdInput.focus());
  </script>
</body>
</html>`;
