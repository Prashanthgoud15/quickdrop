# ⚡ QuickDrop

Transfer text and files between devices using a simple four-digit code. No sign-up, no ads, no unnecessary steps.

**Live demo:** https://quickdrop-woad.vercel.app/

---

## ✨ Features

- **Text sharing** — send text, notes, links, and code snippets between devices
- **File sharing** — upload images, PDFs, documents, videos, archives, and other file types
- **Batch upload** — select or drag and drop multiple files at once
- **Four-digit sharing code** — generate a simple code to retrieve your content
- **Cross-device transfer** — share content between phones, tablets, laptops, and desktops
- **Cross-network support** — retrieve content over different internet connections
- **Repeated retrieval** — retrieve shared content multiple times while the transfer remains active
- **Copy code** — copy the sharing code with one click
- **Download files** — download individual files or multiple files together
- **No visible countdown** — transfers remain available while the session is active
- **Automatic expiry** — transfers expire when the session ends or the server-side inactivity policy takes effect
- **Dark / light mode** — switch between themes
- **Privacy-focused** — no user accounts, permanent transfer history, or unnecessary tracking

## 🛠️ Tech Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/) for the frontend
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) for the backend
- [Multer](https://github.com/expressjs/multer) for file uploads
- [Vercel](https://vercel.com/) for frontend deployment
- [Render](https://render.com/) for backend hosting

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm

### Install dependencies

Clone the repository and navigate to the project directory.

```bash
git clone https://github.com/Prashanthgoud15/QuickDrop.git
cd QuickDrop

npm install
npm install --prefix client
npm install --prefix server
```

### Configure environment variables

Create a `.env` file inside the `server` directory using `.env.example` as a reference.

Configure the required environment variables for the frontend origin, upload directory, file-size limits, and inactivity timeout.

Never commit secrets or private environment files to GitHub.

### Run the development server

```bash
npm run dev
```

Open the local frontend URL displayed in your terminal.

### Build for production

```bash
npm run build
```

## 🌐 Deployment

- **Frontend:** Vercel
- **Backend:** Render

The frontend communicates with the Express API through a Vercel rewrite configuration.

The backend handles sharing-code generation, temporary transfer storage, file uploads, retrieval, and session expiry.

## 🔒 Privacy & Limitations

QuickDrop is designed for temporary transfers without user accounts.

- Transfers are available only while their sessions remain active.
- The backend enforces expiry and cleanup policies.
- Uploaded files are temporarily stored to enable retrieval from other devices.
- Four-digit codes are short and should not be treated as strong authentication.
- Transfer availability depends on the backend and storage implementation.

Do not use QuickDrop for sensitive files until the deployment's storage, access controls, and cleanup behavior have been fully tested.

## 👤 Author

Built by **Prashanth Goud**

[LinkedIn](https://www.linkedin.com/in/prashanth-goud-372485294/)