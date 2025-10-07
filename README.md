# Goodreads Random Book Picker
A lightweight Cloudflare Worker that lets you enter your Goodreads numeric user ID and get a random book from your **Want-to-Read** shelf.

No server, no backend, no database—just a single Worker script that serves the UI **and** the API from the same URL.

---

## Live Demo
Visit: `https://YOUR-WORKER-NAME.YOUR-ACCOUNT.workers.dev/`  
Enter your Goodreads numeric ID (e.g., `137464693`) → click **Load and Pick** → instantly get a random book suggestion.

---

## How It Works
- Fetches the user’s public Goodreads RSS feed:  
  `https://www.goodreads.com/review/list_rss/{USER_ID}?shelf=to-read`
- Parses the feed inside the Worker (no external dependencies).
- Serves a minimal, responsive HTML UI built into the Worker script.
- Uses strong [Content Security Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP) and other security headers.

---

## Deploy Your Own
1. Log in to [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/).
2. Create a new **Worker** → click **Quick Edit**.
3. Paste the contents of `worker.js`.
4. Click **Save and Deploy**.
5. Share your `.workers.dev` link with friends.

---

## Local Edits / Version Control
- This repository contains:
  - `worker.js` — the complete Cloudflare Worker (UI + API).
  - `README.md` — documentation.
  - `LICENSE` — MIT License.
- Edit `worker.js` in GitHub, commit, and copy/paste to Cloudflare’s Quick Edit to redeploy.

---

## Privacy & Data Use
- Uses **public Goodreads RSS feeds only**—no authentication, API keys, or OAuth.
- The Worker stores **no data** and logs **no user input**.
- If a Goodreads shelf is private, it simply won’t load.

---

## Tech Stack
- **Cloudflare Workers** for hosting and execution.
- **Vanilla JavaScript + HTML + CSS** for the UI.
- **No frameworks, databases, or build tools.**

---

## License
This project is open source under the [MIT License](./LICENSE).


---

## Future Enhancements
- Goodreads OAuth integration for private shelves.
- Save favorite picks to localStorage.
- Theming or dark-mode toggle.
- Mobile-optimized layout.

---

*Developed by Tyler Collins.*

