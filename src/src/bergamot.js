import registry from './bergamot-models.json' with { type: 'json' };
import { ServiceError } from './api.js';

export const MODEL_CACHE = 'lyrics-bergamot-models-v1';
export const LOCAL_LANGUAGES = ['en', ...Object.keys(registry).filter(pair => pair.endsWith('en')).map(pair => pair.slice(0, 2))];

function modelPairs(source) {
  if (!LOCAL_LANGUAGES.includes(source)) throw new ServiceError('translationUnsupported');
  return source === 'en' ? ['enpt'] : [`${source}en`, 'enpt'];
}

function permissionError(origins) {
  const error = new ServiceError('translationModelPermission');
  error.origins = origins;
  return error;
}

export async function checkModelPermissions(files, cache, permissions) {
  const saved = new Set((await cache.keys()).map(request => request.url));
  const origins = [...new Set(files.filter(file => !saved.has(file.name)).map(file => `${new URL(file.name).origin}/*`))];
  const missing = [];
  for (const origin of origins) if (!await permissions.contains({ origins: [origin] })) missing.push(origin);
  if (missing.length) throw permissionError(missing);
}

export async function modelCacheSize() {
  const cache = await caches.open(MODEL_CACHE);
  const responses = await Promise.all((await cache.keys()).map(key => cache.match(key)));
  return responses.reduce((sum, response) => sum + Number(response.headers.get('Content-Length') || 0), 0);
}

export async function clearModels() { await caches.delete(MODEL_CACHE); }

async function verifiedBuffer(response, file) {
  const buffer = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (buffer.byteLength !== file.size || hash !== file.expectedSha256Hash) throw new ServiceError('translationModelDownload');
  return buffer;
}

async function loadFile(file, cache, { signal, onBytes }) {
  const saved = await cache.match(file.name);
  if (saved) {
    try { const buffer = await verifiedBuffer(saved, file); onBytes(file.size, true); return buffer; }
    catch {
      await cache.delete(file.name);
      await checkModelPermissions([file], cache, browser.permissions);
    }
  }
  signal?.throwIfAborted();
  try {
    const response = await fetch(file.name, { signal: AbortSignal.any([signal, AbortSignal.timeout(90000)].filter(Boolean)), credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new ServiceError('translationModelDownload');
    const stream = file.compression === 'gzip' && response.headers.get('Content-Encoding') !== 'gzip'
      ? response.body.pipeThrough(new DecompressionStream('gzip')) : response.body;
    const reader = stream.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value); length += value.byteLength; onBytes(value.byteLength);
      if (length > file.size) { await reader.cancel(); throw new ServiceError('translationModelDownload'); }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const buffer = await verifiedBuffer(new Response(bytes), file);
    signal?.throwIfAborted();
    await cache.put(file.name, new Response(buffer, { headers: { 'Content-Length': String(buffer.byteLength), 'Content-Type': 'application/octet-stream' } }));
    return buffer;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    // Host access can also be revoked while a transfer is in progress.
    if (!await browser.permissions.contains({ origins: [`${new URL(file.name).origin}/*`] })) throw permissionError([`${new URL(file.name).origin}/*`]);
    throw new ServiceError('translationModelDownload', error);
  }
}

export async function translateLocally(texts, source, { signal, onProgress } = {}) {
  const pairs = modelPairs(source);
  const cache = await caches.open(MODEL_CACHE);
  await checkModelPermissions(pairs.flatMap(pair => Object.values(registry[pair])), cache, browser.permissions);
  const total = pairs.reduce((sum, pair) => sum + Object.values(registry[pair]).reduce((size, file) => size + file.size, 0), 0);
  let loaded = 0;
  const onBytes = (bytes, cached = false) => { loaded += bytes; onProgress?.(cached ? { stage: 'loadingModel' } : { stage: 'downloading', loaded, total }); };
  const models = [];
  for (const pair of pairs) {
    const files = registry[pair];
    const model = await loadFile(files.model, cache, { signal, onBytes });
    const shortlist = await loadFile(files.lex, cache, { signal, onBytes });
    const vocab = await loadFile(files.vocab, cache, { signal, onBytes });
    models.push({ pair, buffers: { model, shortlist, vocabs: [vocab], config: files.model.name.endsWith('intgemm8.bin') ? { 'gemm-precision': 'int8shiftAll' } : {} } });
  }
  signal?.throwIfAborted();
  onProgress?.({ stage: 'loadingModel' });
  const worker = new Worker(new URL('bergamot/translator-worker.js', location.href));
  let serial = 0;
  const pending = new Map();
  const fail = error => { for (const { reject } of pending.values()) reject(error); pending.clear(); worker.terminate(); };
  const abort = () => fail(new DOMException('Cancelled', 'AbortError'));
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    data.error ? request.reject(new ServiceError('translationLocalFailed', new Error(data.error.message))) : request.resolve(data.result);
  };
  worker.onerror = () => fail(new ServiceError('translationLocalFailed'));
  const call = (name, ...args) => new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const id = ++serial;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, name, args });
  });
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => fail(new ServiceError('timeout')), 120000);
  try {
    await call('initialize', { cacheSize: 1024, useNativeIntGemm: false });
    for (const { pair, buffers } of models) await call('loadTranslationModel', { from: pair.slice(0, 2), to: pair.slice(2) }, buffers);
    onProgress?.({ stage: 'translating', done: 0, total: texts.length });
    const responses = await call('translate', { models: pairs.map(pair => ({ from: pair.slice(0, 2), to: pair.slice(2) })), texts: texts.map(text => ({ text, html: false, qualityScores: false })) });
    return responses.map(response => response.target.text);
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.terminate();
  }
}
