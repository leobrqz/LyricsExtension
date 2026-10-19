import { franc } from 'franc-min';
import { requestJson, TRANSLATION_API, ServiceError } from './api.js';
import { splitUtf8, decodeEntities } from './model.js';

const languageCodes = {
  eng: 'en', por: 'pt', spa: 'es', fra: 'fr', deu: 'de', ita: 'it', nld: 'nl', pol: 'pl',
  rus: 'ru', ukr: 'uk', jpn: 'ja', kor: 'ko', cmn: 'zh', arb: 'ar', hin: 'hi', tur: 'tr',
  swe: 'sv', dan: 'da', fin: 'fi', ell: 'el', ron: 'ro', hun: 'hu', vie: 'vi', ind: 'id', tha: 'th', heb: 'he',
};

export function detectLanguage(text) {
  return languageCodes[franc(text, { minLength: 30 })] || '';
}

export async function translateLine(text, source, target, options = {}) {
  const parts = [];
  for (const part of splitUtf8(text)) {
    const query = new URLSearchParams({ q: part, langpair: `${source}|${target}`, mt: '1' });
    const data = await requestJson(`${TRANSLATION_API}/get?${query}`, options);
    if (data.quotaFinished || Number(data.responseStatus) === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE FREE/i.test(data.responseData?.translatedText || '')) {
      throw new ServiceError('quota');
    }
    const translated = data.responseData?.translatedText;
    if (Number(data.responseStatus) !== 200 || typeof translated !== 'string' || !translated.trim()) {
      throw new ServiceError('translationUnavailable');
    }
    parts.push(decodeEntities(translated).trim());
  }
  return parts.join(' ');
}

export async function translateLines(lines, source, target, { cached = [], onProgress = () => {}, signal, fetcher } = {}) {
  if (!source) throw new ServiceError('unknownLanguage');
  if (source === target) throw new ServiceError('sameLanguage');
  const output = lines.map((line, index) => !line.trim() ? '' : cached[index] || null);
  const byText = new Map();
  lines.forEach((line, index) => { if (output[index]) byText.set(line, output[index]); });
  const missing = [...new Set(lines.filter((line, index) => line.trim() && !output[index] && !byText.has(line)))];
  const failures = [];
  let position = 0;
  let stopForQuota = false;
  const emit = () => {
    lines.forEach((line, index) => { if (byText.has(line)) output[index] = byText.get(line); });
    onProgress([...output]);
  };
  emit();
  async function worker() {
    while (position < missing.length && !stopForQuota) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const line = missing[position++];
      try { byText.set(line, await translateLine(line, source, target, { signal, fetcher })); emit(); }
      catch (error) {
        if (error.name === 'AbortError') throw error;
        failures.push(error.code || 'translationUnavailable');
        if (error.code === 'quota') stopForQuota = true;
      }
    }
  }
  await Promise.all([worker(), worker()]);
  const complete = output.every((line, index) => !lines[index].trim() || Boolean(line));
  return { lines: output, complete, error: failures.includes('quota') ? 'quota' : complete ? null : 'translationPartial' };
}
