// Clip helpers: detect the source of a link and pull out YouTube ids / timestamps.

export const SOURCES = {
  youtube:  { label: 'YouTube',      short: 'YT', color: '#ff3b30' },
  fanatics: { label: 'BJJ Fanatics', short: 'BF', color: '#e8b130' },
  submeta:  { label: 'Submeta',      short: 'SM', color: '#7c5cff' },
  instagram:{ label: 'Instagram',    short: 'IG', color: '#d62976' },
  link:     { label: 'Link',         short: '↗',  color: '#8e8e93' },
};

export function detectSource(url = '') {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/bjjfanatics\.com/.test(u)) return 'fanatics';
  if (/submeta\.io/.test(u)) return 'submeta';
  if (/instagram\.com/.test(u)) return 'instagram';
  return 'link';
}

// "1:23", "01:02:03", "83", "1m23s" -> seconds (or null)
export function parseTime(t) {
  if (t == null) return null;
  const s = String(t).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const hms = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (hms && (hms[1] || hms[2] || hms[3])) return (+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0);
  const parts = s.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN) || parts.length > 3) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function formatTime(sec) {
  if (sec == null || isNaN(sec)) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function youtubeInfo(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname.startsWith('/watch')) id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
    if (!id) return null;
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    return { id, start: t ? parseTime(t.replace(/s$/, '')) ?? parseTime(t) : null };
  } catch {
    return null;
  }
}

// Link that opens the clip at its timestamp where the site supports it.
export function clipOpenUrl(clip) {
  if (clip.source === 'youtube') {
    const yt = youtubeInfo(clip.url);
    if (yt) {
      const start = clip.start ?? yt.start;
      return `https://www.youtube.com/watch?v=${yt.id}${start ? `&t=${start}s` : ''}`;
    }
  }
  return clip.url;
}

export function normalizeUrl(url) {
  const s = url.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}
