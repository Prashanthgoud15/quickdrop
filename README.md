# QuickDrop

QuickDrop is a minimal, temporary code-based sharing tool for transferring text and files between devices. Its visual design follows the same clean black-and-white, centered layout as the Image To PDF project: simple typography, thin borders, rounded controls, and a light/dark theme toggle. No marketing sections or extra landing-page content.

## Stack
- React + Vite + Tailwind CSS + Lucide React
- Node.js + Express + Multer
- Temporary local file storage and an in-memory active-transfer registry

## Run locally
Requires Node.js 20+ and npm.

```bash
npm install
npm install --prefix client
npm install --prefix server
cp server/.env.example server/.env
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). The Vite dev server proxies `/api` to Express at `http://localhost:4000`.

## How it works
1. Sender pastes text and/or selects files.
2. Express stores files temporarily and creates a random four-digit code.
3. Receiver enters the code and can retrieve content while the transfer is active.
4. Sender can end the transfer or replace it by uploading again.
5. Closing the sender page sends a best-effort request to end the transfer. Browser tab-close events are not guaranteed, so the server also expires inactive transfers after the configured timeout.

## Deployment notes
This starter uses local disk storage and an in-memory transfer registry. It is intended for local development or a single long-running server, not a multi-instance/serverless deployment. A server restart clears active transfer records; startup cleanup removes leftover uploaded files. For production, use a shared registry such as Redis/database and private object storage, and configure persistent storage.

Four-digit codes are short for usability, not strong authentication. The API includes rate limiting and limits failed code attempts. Use HTTPS in production and do not transfer highly sensitive material without a stronger security design.

## Environment variables
See `server/.env.example`.
