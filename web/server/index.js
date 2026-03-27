import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import bigInt from 'big-integer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2000 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Serve built frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ─── State ───────────────────────────────────────────
let client = null;
let apiId = null;
let apiHash = null;
let phoneNumber = null;
let phoneCodeHash = null;

const SESSION_FILE = path.join(__dirname, 'session.txt');
const BW_FILE = path.join(__dirname, 'bandwidth.json');

function loadSession() {
  try { return fs.readFileSync(SESSION_FILE, 'utf8').trim(); } catch { return ''; }
}
function saveSession() {
  if (client?.session) fs.writeFileSync(SESSION_FILE, client.session.save());
}

// ─── Bandwidth ───────────────────────────────────────
let bandwidth = { date: new Date().toISOString().slice(0, 10), up_bytes: 0, down_bytes: 0 };
try {
  const saved = JSON.parse(fs.readFileSync(BW_FILE, 'utf8'));
  if (saved.date === bandwidth.date) bandwidth = saved;
} catch {}
function saveBandwidth() { fs.writeFileSync(BW_FILE, JSON.stringify(bandwidth)); }
function checkBandwidthDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (bandwidth.date !== today) { bandwidth = { date: today, up_bytes: 0, down_bytes: 0 }; saveBandwidth(); }
}

// ─── Helpers ─────────────────────────────────────────
async function resolvePeer(folderId) {
  if (!folderId || folderId === 'null' || folderId === 'me') {
    return await client.getMe();
  }
  // Try to resolve as channel/chat
  try {
    const entity = await client.getEntity(bigInt(folderId));
    return entity;
  } catch {
    // Iterate dialogs as fallback
    const dialogs = await client.getDialogs({ limit: 200 });
    for (const d of dialogs) {
      const peerId = d.id?.toString() || '';
      if (peerId === String(folderId) || peerId === String(-Number(folderId))) {
        return d.entity;
      }
    }
    throw new Error(`Peer ${folderId} not found`);
  }
}

function getFileInfo(msg) {
  if (!msg.media) return null;
  let name = 'file';
  let size = 0;
  let mimeType = 'application/octet-stream';
  let iconType = 'file';

  if (msg.media instanceof Api.MessageMediaDocument && msg.media.document instanceof Api.Document) {
    const doc = msg.media.document;
    size = Number(doc.size);
    mimeType = doc.mimeType || mimeType;
    for (const attr of doc.attributes || []) {
      if (attr instanceof Api.DocumentAttributeFilename) name = attr.fileName;
      if (attr instanceof Api.DocumentAttributeVideo) iconType = 'video';
      if (attr instanceof Api.DocumentAttributeAudio) iconType = 'audio';
      if (attr instanceof Api.DocumentAttributeImageSize) iconType = 'image';
    }
    if (mimeType.startsWith('image/') && iconType === 'file') iconType = 'image';
    if (mimeType.startsWith('video/') && iconType === 'file') iconType = 'video';
    if (mimeType.startsWith('audio/') && iconType === 'file') iconType = 'audio';
  } else if (msg.media instanceof Api.MessageMediaPhoto) {
    name = `photo_${msg.id}.jpg`;
    iconType = 'image';
    if (msg.media.photo instanceof Api.Photo) {
      const sizes = msg.media.photo.sizes || [];
      const largest = sizes[sizes.length - 1];
      size = largest?.size || 0;
    }
  }
  return {
    id: msg.id,
    name,
    size,
    sizeStr: formatBytes(size),
    icon_type: iconType,
    mime_type: mimeType,
    created_at: msg.date ? new Date(msg.date * 1000).toISOString() : '',
  };
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// ─── Auth Routes ─────────────────────────────────────
app.post('/api/cmd_connect', async (req, res) => {
  try {
    const { apiId: id } = req.body;
    if (!client) return res.json({ error: 'Not initialized. Call request_code first.' });
    if (await client.checkAuthorization()) {
      saveSession();
      return res.json(true);
    }
    return res.json(true);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_auth_request_code', async (req, res) => {
  try {
    const { phone, apiId: id, apiHash: hash } = req.body;
    apiId = parseInt(id);
    apiHash = hash;
    phoneNumber = phone;

    const session = new StringSession(loadSession());
    client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
    });
    await client.connect();

    if (await client.checkAuthorization()) {
      saveSession();
      return res.json('already_authorized');
    }

    const result = await client.sendCode({ apiId, apiHash }, phone);
    phoneCodeHash = result.phoneCodeHash;
    res.json('code_sent');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_auth_sign_in', async (req, res) => {
  try {
    const { code } = req.body;
    try {
      await client.invoke(new Api.auth.SignIn({
        phoneNumber: phoneNumber,
        phoneCodeHash: phoneCodeHash,
        phoneCode: code,
      }));
      saveSession();
      res.json({ success: true, next_step: 'dashboard', error: null });
    } catch (err) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        res.json({ success: false, next_step: 'password', error: null });
      } else {
        res.json({ success: false, next_step: null, error: err.message });
      }
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_auth_check_password', async (req, res) => {
  try {
    const { password } = req.body;
    await client.signInWithPassword({ apiId, apiHash }, {
      password: async () => password,
      onError: (e) => { throw e; },
    });
    saveSession();
    res.json({ success: true, next_step: 'dashboard', error: null });
  } catch (e) {
    res.json({ success: false, next_step: null, error: e.message });
  }
});

app.post('/api/cmd_logout', async (req, res) => {
  try {
    if (client) {
      try { await client.invoke(new Api.auth.LogOut()); } catch {}
      await client.disconnect();
    }
    client = null;
    try { fs.unlinkSync(SESSION_FILE); } catch {}
    res.json(true);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── File Routes ─────────────────────────────────────
app.post('/api/cmd_get_files', async (req, res) => {
  try {
    const { folderId } = req.body;
    const peer = await resolvePeer(folderId);
    const messages = await client.getMessages(peer, { limit: 500 });
    const files = messages
      .map(msg => getFileInfo(msg))
      .filter(Boolean);
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_upload_file', upload.single('file'), async (req, res) => {
  try {
    const folderId = req.body.folderId;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const peer = await resolvePeer(folderId);
    checkBandwidthDay();
    bandwidth.up_bytes += file.size;
    saveBandwidth();

    await client.sendFile(peer, {
      file: new Api.InputFile({
        id: bigInt(Date.now()),
        parts: 1,
        name: file.originalname,
        md5Checksum: '',
      }),
      workers: 1,
    });
    // Use uploadFile approach
    const result = await client.sendFile(peer, {
      file: Buffer.from(file.buffer),
      fileName: file.originalname,
      forceDocument: true,
    });
    res.json({ id: result.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_delete_file', async (req, res) => {
  try {
    const { messageId, folderId } = req.body;
    const peer = await resolvePeer(folderId);
    await client.deleteMessages(peer, [messageId], { revoke: true });
    res.json(true);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_download_file', async (req, res) => {
  try {
    const { messageId, folderId } = req.body;
    const peer = await resolvePeer(folderId);
    const messages = await client.getMessages(peer, { ids: [messageId] });
    const msg = messages[0];
    if (!msg?.media) return res.status(404).json({ error: 'Media not found' });

    const buffer = await client.downloadMedia(msg.media, {});
    checkBandwidthDay();
    bandwidth.down_bytes += buffer.length;
    saveBandwidth();

    const info = getFileInfo(msg);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(info.name)}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_move_files', async (req, res) => {
  try {
    const { messageIds, sourceFolderId, targetFolderId } = req.body;
    const sourcePeer = await resolvePeer(sourceFolderId);
    const targetPeer = await resolvePeer(targetFolderId);

    for (const msgId of messageIds) {
      const messages = await client.getMessages(sourcePeer, { ids: [msgId] });
      const msg = messages[0];
      if (msg?.media) {
        const buffer = await client.downloadMedia(msg.media, {});
        const info = getFileInfo(msg);
        await client.sendFile(targetPeer, {
          file: buffer,
          fileName: info.name,
          forceDocument: true,
        });
        await client.deleteMessages(sourcePeer, [msgId], { revoke: true });
      }
    }
    res.json(true);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Folder Routes ───────────────────────────────────
app.post('/api/cmd_create_folder', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await client.invoke(new Api.channels.CreateChannel({
      title: name,
      about: 'Telegram Drive folder',
      megagroup: false,
    }));
    const channel = result.chats[0];
    res.json({ id: Number(channel.id), name: channel.title });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_delete_folder', async (req, res) => {
  try {
    const { folderId } = req.body;
    const peer = await resolvePeer(folderId);
    await client.invoke(new Api.channels.DeleteChannel({ channel: peer }));
    res.json(true);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cmd_scan_folders', async (req, res) => {
  try {
    const dialogs = await client.getDialogs({ limit: 500 });
    const folders = [];
    for (const d of dialogs) {
      if (d.isChannel && !d.isGroup) {
        folders.push({ id: Number(d.id), name: d.title || d.name || 'Channel' });
      }
    }
    res.json(folders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Utility Routes ──────────────────────────────────
app.post('/api/cmd_get_bandwidth', (req, res) => {
  checkBandwidthDay();
  res.json(bandwidth);
});

app.post('/api/cmd_search_global', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.length < 2) return res.json([]);
    // Search across saved messages
    const me = await client.getMe();
    const messages = await client.getMessages(me, { search: query, limit: 50 });
    const files = messages.map(msg => getFileInfo(msg)).filter(Boolean);
    res.json(files);
  } catch (e) { res.json([]); }
});

app.post('/api/cmd_check_connection', async (req, res) => {
  try {
    if (!client) return res.json(false);
    await client.getMe();
    res.json(true);
  } catch { res.json(false); }
});

app.post('/api/cmd_is_network_available', (req, res) => res.json(true));
app.post('/api/cmd_log', (req, res) => { console.log('[FRONTEND]', req.body.message); res.json(null); });
app.post('/api/cmd_clean_cache', (req, res) => res.json(true));

app.post('/api/cmd_get_preview', async (req, res) => {
  try {
    const { messageId, folderId } = req.body;
    const peer = await resolvePeer(folderId);
    const messages = await client.getMessages(peer, { ids: [messageId] });
    const msg = messages[0];
    if (!msg?.media) return res.json(null);

    const buffer = await client.downloadMedia(msg.media, {});
    const base64 = buffer.toString('base64');
    const info = getFileInfo(msg);
    const mime = info?.mime_type || 'application/octet-stream';
    res.json(`data:${mime};base64,${base64}`);
  } catch { res.json(null); }
});

app.post('/api/cmd_get_thumbnail', async (req, res) => {
  try {
    const { messageId, folderId } = req.body;
    const peer = await resolvePeer(folderId);
    const messages = await client.getMessages(peer, { ids: [messageId] });
    const msg = messages[0];
    if (!msg?.media) return res.json(null);

    // Download thumbnail (small version)
    const buffer = await client.downloadMedia(msg.media, { thumb: 0 });
    if (buffer) {
      const base64 = buffer.toString('base64');
      res.json(`data:image/jpeg;base64,${base64}`);
    } else {
      res.json(null);
    }
  } catch { res.json(null); }
});

// ─── Streaming ───────────────────────────────────────
app.get('/stream/:folderId/:messageId', async (req, res) => {
  try {
    const { folderId, messageId } = req.params;
    const peer = await resolvePeer(folderId === 'null' || folderId === 'me' ? null : folderId);
    const messages = await client.getMessages(peer, { ids: [parseInt(messageId)] });
    const msg = messages[0];
    if (!msg?.media) return res.status(404).send('Not found');

    const buffer = await client.downloadMedia(msg.media, {});
    const info = getFileInfo(msg);
    res.set({
      'Content-Type': info.mime_type || 'application/octet-stream',
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=120',
    });
    res.send(buffer);
  } catch (e) { res.status(500).send(e.message); }
});

// ─── SPA Fallback ────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('<h1>Telegram Drive Web</h1><p>Frontend not built yet. Run: npm run build</p>');
  }
});

const PORT = process.env.PORT || 3210;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Telegram Drive Web Server running on port ${PORT}`);
  console.log(`📂 Serving frontend from: ${distPath}`);
});
