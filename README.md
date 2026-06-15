# Vault

A minimal personal password manager that runs in the browser. All data is encrypted locally and never leaves your device.

## Features

- AES-256-GCM encryption via Web Crypto API
- PBKDF2 key derivation (200k iterations)
- Add, edit, delete entries (name, username, password, URL, notes)
- Password generator
- Search
- Works offline (service worker)

## Usage

```bash
node server.js
```

Open `http://localhost:3000` in your browser. Set any master password on first use.

## Mobile

To use on your phone, both devices must be on the same WiFi. The server must run over HTTPS because `crypto.subtle` (required for encryption) is not available on plain HTTP connections from non-localhost origins.

```bash
node gen-cert.js   # one time only
node server.js     # now runs on https://
```

Open `https://192.168.x.x:3000` on your phone and accept the self-signed certificate warning.

Alternatively, deploy to Vercel — HTTPS is automatic and no certificate setup is needed.

## Deployment

Push to GitHub and import on [vercel.com](https://vercel.com). No build step or configuration required. `server.js` is for local use only and is ignored by Vercel.

## Stack

Plain HTML, CSS, and JavaScript. No frameworks, no dependencies, no build tools.

Built entirely with [Claude Code](https://claude.ai/code).

## Security notes

- Vault is encrypted with AES-256-GCM using a key derived from your master password
- Salt is randomly generated per vault and stored in `localStorage`
- Everything stays in the browser — no server, no accounts, no sync
- Losing your master password means losing access to your vault permanently
