# Starbound Run — original retro platform game

A small, original 2D side-scrolling platform game inspired by classic platform adventures. It is not a Mario/Nintendo asset or character clone.

## Included
- Touch controls for phones and tablets
- Keyboard controls for desktop testing (arrow keys / A-D, Space or Up to jump)
- Two levels, coins, enemies, stomp attacks, lives, score, finish flag
- Sound effects with mute toggle
- Progressive Web App manifest and service worker for install/offline caching
- Responsive full-screen canvas

## Run locally
The simplest method is to serve this folder with any static web server. For example:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

Opening `index.html` directly works for gameplay, but PWA installation and offline caching require HTTPS or localhost.

## Publish so iPhone and Android can install it
1. Create a GitHub repository (for example `starbound-run`).
2. Upload all five project files: `index.html`, `game.js`, `manifest.webmanifest`, `sw.js`, and `icon.svg`.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish. Open the HTTPS URL on your phone.

### Install on iPhone / iPad
Open the published game in Safari → Share → Add to Home Screen → Add.

### Install on Android
Open the published game in Chrome → menu (⋮) → Install app / Add to Home screen.

## Important
This is a web app (PWA), so one codebase runs on iOS and Android. It is not yet a signed native App Store / Google Play package. Publishing to those stores requires additional packaging, developer accounts, store assets, and review.
