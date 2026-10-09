import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);
const uploadDir = path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads');
const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024;
const inactivityMs = Number(process.env.INACTIVITY_MINUTES || 30) * 60 * 1000;
fs.mkdirSync(uploadDir, { recursive: true });

// The active transfer registry is intentionally in-memory for this starter.
// Use Redis/database + private object storage for a production multi-instance deployment.
const transfers = new Map();
const codeFailures = new Map();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${nanoid(18)}${path.extname(file.originalname).slice(0, 12)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: maxFileSize, files: 20, fieldSize: 1_000_000 },
  fileFilter: (_req, _file, cb) => cb(null, true)
});

function safeFile(file) {
  return {
    id: file.id,
    name: file.originalName,
    size: file.size,
    mimeType: file.mimeType
  };
}
function activeTransfer(code) {
  const transfer = transfers.get(code);
  if (!transfer) return null;
  if (Date.now() - transfer.lastActivity > inactivityMs) {
    void deleteTransfer(code);
    return null;
  }
  return transfer;
}
async function deleteTransfer(code) {
  const transfer = transfers.get(code);
  if (!transfer) return;
  transfers.delete(code);
  for (const file of transfer.files) {
    try { await fs.promises.unlink(path.join(uploadDir, file.storedName)); } catch { /* already removed */ }
  }
}
function makeCode() {
  for (let i = 0; i < 200; i++) {
    const code = String(randomInt(0, 10_000)).padStart(4, '0');
    if (!transfers.has(code)) return code;
  }
  throw new Error('Could not allocate a code. Please try again.');
}

// Remove leftovers from a prior process because its in-memory transfer registry is gone.
for (const name of fs.readdirSync(uploadDir)) {
  try { fs.unlinkSync(path.join(uploadDir, name)); } catch { /* ignore */ }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'QuickDrop' }));

app.post('/api/transfers', upload.array('files', 20), async (req, res) => {
  const text = String(req.body.text || '');
  const ownerId = String(req.body.ownerId || '').slice(0, 100);
  const incoming = req.files || [];
  if (!text.trim() && incoming.length === 0) {
    return res.status(400).json({ error: 'Add some text or choose at least one file.' });
  }
  if (!ownerId) return res.status(400).json({ error: 'Missing sender session. Refresh and try again.' });

  // Replace the sender's previous active transfer.
  for (const [code, transfer] of transfers.entries()) {
    if (transfer.ownerId === ownerId) await deleteTransfer(code);
  }

  try {
    const code = makeCode();
    const files = incoming.map(file => ({
      id: nanoid(12), storedName: file.filename, originalName: path.basename(file.originalname).slice(0, 240),
      size: file.size, mimeType: file.mimetype || 'application/octet-stream'
    }));
    const transfer = {
      code, ownerId, text, files, createdAt: Date.now(), lastActivity: Date.now()
    };
    transfers.set(code, transfer);
    res.status(201).json({ code, textLength: text.length, files: files.map(safeFile) });
  } catch (error) {
    for (const file of incoming) { try { await fs.promises.unlink(file.path); } catch {} }
    res.status(500).json({ error: error.message || 'Could not create transfer.' });
  }
});

app.post('/api/transfers/:code/retrieve', (req, res) => {
  const code = String(req.params.code || '');
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Enter a valid four-digit code.' });
  const failures = codeFailures.get(req.ip) || { count: 0, resetAt: Date.now() + 60_000 };
  if (Date.now() > failures.resetAt) { failures.count = 0; failures.resetAt = Date.now() + 60_000; }
  if (failures.count >= 30) return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });

  const transfer = activeTransfer(code);
  if (!transfer) {
    failures.count += 1; codeFailures.set(req.ip, failures);
    return res.status(404).json({ error: 'No active transfer found for that code.' });
  }
  codeFailures.delete(req.ip);
  transfer.lastActivity = Date.now();
  res.json({ code, text: transfer.text, files: transfer.files.map(safeFile) });
});

app.get('/api/transfers/:code/files/:fileId', (req, res) => {
  const transfer = activeTransfer(String(req.params.code || ''));
  if (!transfer) return res.status(404).json({ error: 'This transfer is no longer available.' });
  const file = transfer.files.find(item => item.id === req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found in this transfer.' });
  transfer.lastActivity = Date.now();
  res.download(path.join(uploadDir, file.storedName), file.originalName, error => {
    if (error && !res.headersSent) res.status(500).json({ error: 'Download failed. Please try again.' });
  });
});

app.post('/api/transfers/:code/end', async (req, res) => {
  const code = String(req.params.code || '');
  const transfer = transfers.get(code);
  if (!transfer) return res.json({ ok: true });
  const ownerId = String(req.body.ownerId || '');
  if (!ownerId || transfer.ownerId !== ownerId) return res.status(403).json({ error: 'Only the sender can end this transfer.' });
  await deleteTransfer(code);
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? `A file exceeds the ${process.env.MAX_FILE_SIZE_MB || 100} MB upload limit.`
      : error.code === 'LIMIT_FILE_COUNT' ? 'You can upload up to 20 files at once.' : error.message;
    return res.status(400).json({ error: message });
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, transfer] of transfers.entries()) {
    if (now - transfer.lastActivity > inactivityMs) void deleteTransfer(code);
  }
  for (const [ip, record] of codeFailures.entries()) if (now > record.resetAt + 60_000) codeFailures.delete(ip);
}, 60_000).unref();

app.listen(PORT, () => console.log(`QuickDrop API running on http://localhost:${PORT}`));
