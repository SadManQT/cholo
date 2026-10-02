# চলো — full feature walkthrough (10 min)

Built from `marketing/walkthrough-video-prompt.md`. Acts 1–4 are real screen recordings of the app
(`origin/main`, demo seed) and Act 5 is animated. Everything is rendered from code; nothing is edited by hand.

## Deliverables (`deliver/`)
| File | What |
|---|---|
| `cholo-walkthrough.mp4` | Master, 1920×1080, 30 fps, H.264 + AAC, −14 LUFS, English captions burned in (kept out of git; too large) |
| `cholo-90s.mp4` | 90 s 16:9 cut |
| `cholo-60s-vertical.mp4` | 60 s 1080×1920 cut for Reels / Shorts / TikTok |
| `cholo-15s-teaser.mp4` | 15 s teaser |
| `walkthrough.en.srt`, `walkthrough.bn.srt` | Subtitles in English and Bangla |
| `vo-script.md` | Voice-over script (EN + BN), one line per caption, with timings |
| `chapters.txt` | YouTube chapter markers |
| `thumbnail.png` | 1920×1080 thumbnail |

## How it is made
1. **Run the app locally.** Use the API with Postgres, `seed.dev` and `seed.demo`, plus the web build served by `vite preview`.
   `tools/mocks.mjs` stands in for OSRM, Photon and SSLCommerz. Playwright serves map tiles (`tools/style.mjs`, a
   generated Dhaka map) and fonts locally.
2. **Capture.** `capture/*.mjs` drive the real app (passenger, driver, family and admin each run in their own
   browser) and record CDP screencasts with marks and taps.
3. **Cut.** `tools/clips.mjs` lists each clip as a pair of raw recording and mark range. `tools/cut.mjs` turns them into 30 fps frame folders.
4. **Compose.** `scenes/index.html` and `scenes/*.js` hold the scenes, rendered deterministically by `render(t)`.
5. **Render.** Run `tools/render.mjs segment <from> <to> out.mp4` in parallel workers. `tools/music.py` writes the score and SFX
   from the timeline (`render.mjs timeline tl.json`). `tools/cuts.py` assembles the master and the short cuts.
   `tools/subs.py` writes the SRTs, chapters and VO script, and `tools/stills.mjs` makes the thumbnail and vertical overlay.

Cast: Nusrat Jahan (passenger), Rahim Hossain (driver, green Bajaj CNG, DHAKA METRO-THA 11-2345) and Ayesha Rahman (admin).
