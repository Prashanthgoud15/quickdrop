import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Upload, Download, Copy, Check, AlertCircle, Sun, Moon, X, Plus,
  File as FileIcon, FileImage, FileText, FileVideo, FileAudio, FileArchive,
  RotateCcw, Trash2, Clipboard, ArrowDownToLine, CheckCircle2
} from 'lucide-react';
import './styles.css';

const MAX_FILES = 20;
const formatBytes = bytes => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const iconFor = name => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg','avif','heic','bmp'].includes(ext)) return FileImage;
  if (['mp4','mov','webm','mkv'].includes(ext)) return FileVideo;
  if (['mp3','wav','m4a','ogg'].includes(ext)) return FileAudio;
  if (['zip','rar','7z','tar','gz'].includes(ext)) return FileArchive;
  if (['pdf','doc','docx','txt','rtf','md','csv'].includes(ext)) return FileText;
  return FileIcon;
};

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('quickdrop-theme') || 'light');
  const [mode, setMode] = useState('send');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState(null);
  const [code, setCode] = useState('');
  const [received, setReceived] = useState(null);
  const inputRef = useRef(null);
  const ownerRef = useRef('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('quickdrop-theme', theme);
  }, [theme]);

  useEffect(() => {
    let id = localStorage.getItem('quickdrop-owner-id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('quickdrop-owner-id', id); }
    ownerRef.current = id;
    const previous = sessionStorage.getItem('quickdrop-active-transfer');
    if (previous) { try { setActive(JSON.parse(previous)); } catch { sessionStorage.removeItem('quickdrop-active-transfer'); } }
  }, []);

  useEffect(() => {
    const handlePaste = event => {
      if (mode !== 'send') return;
      const pastedFiles = Array.from(event.clipboardData?.files || []);
      if (pastedFiles.length) {
        setFiles(old => [...old, ...pastedFiles].slice(0, MAX_FILES));
        setError('');
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [mode]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!active?.code || !ownerRef.current) return;
      const body = JSON.stringify({ ownerId: ownerRef.current });
      try { navigator.sendBeacon(`/api/transfers/${active.code}/end`, new Blob([body], { type: 'application/json' })); } catch {}
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [active]);

  const addFiles = incoming => {
    const next = Array.from(incoming || []);
    if (!next.length) return;
    setFiles(old => [...old, ...next].slice(0, MAX_FILES));
    setError(''); setNotice('');
  };
  const removeFile = index => setFiles(old => old.filter((_, i) => i !== index));

  const send = async () => {
    if (!text.trim() && files.length === 0) { setError('Paste some text or choose a file to get started.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData();
      body.append('text', text);
      body.append('ownerId', ownerRef.current);
      files.forEach(file => body.append('files', file));
      const response = await fetch('/api/transfers', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create transfer.');
      const transfer = { code: data.code, files: data.files, textLength: data.textLength };
      setActive(transfer); sessionStorage.setItem('quickdrop-active-transfer', JSON.stringify(transfer));
      setReceived(null); setNotice('Your transfer is ready. Share the code with your other device.');
    } catch (err) { setError(err.message || 'Something went wrong. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  const retrieve = async event => {
    event?.preventDefault();
    if (!/^\d{4}$/.test(code)) { setError('Enter all four digits of the sharing code.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/transfers/${code}/retrieve`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not retrieve this transfer.');
      setReceived(data); setNotice('Transfer found. Your content is ready.');
    } catch (err) { setReceived(null); setError(err.message || 'Could not connect to QuickDrop.'); }
    finally { setBusy(false); }
  };

  const copy = async value => {
    try { await navigator.clipboard.writeText(value); setNotice('Copied to clipboard.'); setError(''); }
    catch { setError('Clipboard access was blocked. Select and copy the text manually.'); }
  };

  const endTransfer = async () => {
    if (!active?.code) return;
    setBusy(true);
    try {
      await fetch(`/api/transfers/${active.code}/end`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerId: ownerRef.current })
      });
      setActive(null); sessionStorage.removeItem('quickdrop-active-transfer'); setNotice('Transfer ended. Temporary files have been removed.'); setError('');
    } catch { setError('Could not end the transfer right now.'); }
    finally { setBusy(false); }
  };

  const downloadFile = async (file, transferCode) => {
    try {
      const response = await fetch(`/api/transfers/${transferCode}/files/${file.id}`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Download failed.'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message || 'Could not download this file.'); }
  };

  const resetComposer = () => { setActive(null); sessionStorage.removeItem('quickdrop-active-transfer'); setText(''); setFiles([]); setReceived(null); setNotice(''); setError(''); };
  const currentFiles = received?.files || active?.files || [];
  const currentCode = received?.code || active?.code;

  return <div className="page-shell">
    <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle color theme" title="Toggle theme">
      {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
    </button>

    <main className="main-wrap">
      <header className="page-heading">
        <h1>QuickDrop</h1>
        <p>Transfer text and files between devices with a simple code</p>
      </header>

      <section className="tool-panel">
        <div className="mode-switch" role="tablist" aria-label="Transfer mode">
          <button role="tab" aria-selected={mode === 'send'} className={mode === 'send' ? 'mode-tab selected' : 'mode-tab'} onClick={() => { setMode('send'); setError(''); setNotice(''); }}><Upload size={15}/> Send</button>
          <button role="tab" aria-selected={mode === 'receive'} className={mode === 'receive' ? 'mode-tab selected' : 'mode-tab'} onClick={() => { setMode('receive'); setError(''); setNotice(''); }}><Download size={15}/> Receive</button>
        </div>

        {mode === 'send' ? <div className="panel-content">
          {active ? <div className="ready-state">
            <div className="success-icon"><CheckCircle2 size={23}/></div>
            <h2>Your code is ready</h2>
            <p className="muted">Enter this code on the device you want to receive on.</p>
            <div className="code-display" aria-label={`Sharing code ${active.code}`}>{active.code.split('').map((digit, i) => <span key={i}>{digit}</span>)}</div>
            <button className="primary-button" onClick={() => copy(active.code)}><Copy size={16}/> Copy sharing code</button>
            <div className="transfer-summary">
              <span>{active.textLength ? 'Text' : ''}{active.textLength && active.files.length ? ' + ' : ''}{active.files.length ? `${active.files.length} file${active.files.length > 1 ? 's' : ''}` : ''}</span>
              <span>Available while active</span>
            </div>
            <button className="text-button danger-text" disabled={busy} onClick={endTransfer}><Trash2 size={14}/> End transfer</button>
            <button className="text-button" onClick={resetComposer}><RotateCcw size={14}/> Send something else</button>
          </div> : <>
            <div className="panel-heading"><h2>Send something</h2><p>Paste text or choose files to share.</p></div>
            <label className="field-label" htmlFor="share-text">Text <span>Optional</span></label>
            <textarea id="share-text" className="text-area" value={text} onChange={e => setText(e.target.value)} placeholder="Paste text, a link, a note, or code here…" rows={5}/>
            <div className="section-divider"><span>and / or add files</span></div>
            <div className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
              <input ref={inputRef} type="file" multiple className="hidden-input" onChange={e => { addFiles(e.target.files); e.target.value = ''; }}/>
              <div className="upload-icon"><Upload size={21}/></div>
              <h3>Drop files here</h3>
              <p>or <button className="inline-link" type="button" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>browse files</button></p>
              <span className="file-hint">Any file type · Up to 20 files</span>
            </div>
            {files.length > 0 && <div className="file-list">
              <div className="file-list-head"><span>{files.length} selected · {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}</span><button className="text-button compact" onClick={() => inputRef.current?.click()}><Plus size={13}/> Add more</button></div>
              {files.map((file, index) => { const Icon = iconFor(file.name); return <div className="file-row" key={`${file.name}-${file.size}-${index}`}><span className="file-type-icon"><Icon size={17}/></span><div className="file-meta"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)}</span></div><button className="remove-file" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><X size={15}/></button></div>; })}
            </div>}
            <button className="primary-button full-button" onClick={send} disabled={busy || (!text.trim() && files.length === 0)}>
              {busy ? <span className="spinner"/> : <Upload size={16}/>} {busy ? 'Preparing transfer…' : 'Generate sharing code'}
            </button>
            <p className="privacy-note"><Clipboard size={13}/> Your content is temporary and available only while the transfer is active.</p>
          </>}
        </div> : <div className="panel-content receive-content">
          <div className="panel-heading"><h2>Receive something</h2><p>Enter the four-digit code shared with you.</p></div>
          <form onSubmit={retrieve}>
            <label className="field-label" htmlFor="sharing-code">Sharing code</label>
            <input id="sharing-code" className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} placeholder="0000" aria-label="Four-digit sharing code"/>
            <button className="primary-button full-button" disabled={busy || code.length !== 4}>{busy ? <span className="spinner"/> : <Download size={16}/>} {busy ? 'Looking for transfer…' : 'Retrieve content'}</button>
          </form>
          {received && <div className="received-content">
            <div className="received-heading"><CheckCircle2 size={17}/><strong>Content is ready</strong></div>
            {received.text && <div className="received-section"><div className="received-section-title"><span>Shared text</span><button className="small-button" onClick={() => copy(received.text)}><Copy size={13}/> Copy</button></div><pre className="received-text">{received.text}</pre></div>}
            {received.files?.length > 0 && <div className="received-section"><div className="received-section-title">Files ({received.files.length})</div>{received.files.map(file => { const Icon = iconFor(file.name); return <div className="file-row received-file" key={file.id}><span className="file-type-icon"><Icon size={17}/></span><div className="file-meta"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)}</span></div><button className="download-button" onClick={() => downloadFile(file, received.code)} aria-label={`Download ${file.name}`}><Download size={15}/></button></div>; })}</div>}
            <p className="download-hint">You can retrieve this content again while the transfer is active.</p>
          </div>}
        </div>}

        {(error || notice) && <div className={`feedback ${error ? 'feedback-error' : 'feedback-success'}`} role="status"><span>{error ? <AlertCircle size={15}/> : <Check size={15}/>}</span><p>{error || notice}</p><button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss message"><X size={14}/></button></div>}
      </section>
    </main>

    <footer className="page-footer"><span>QuickDrop</span><span>Simple, temporary file sharing.</span><a href="https://www.linkedin.com/in/prashanth-goud-372485294/" target="_blank" rel="noopener noreferrer">Built by Prashanth Goud <span aria-hidden="true">↗</span></a></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
