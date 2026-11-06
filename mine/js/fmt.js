// Friendly big-number formatting: 950 -> "950", 804600 -> "804.6k",
// 1234567 -> "1.2M". Kids love big numbers; this keeps them short.

const UNITS = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.floor(n));
  let u = 0;
  while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
  if (n >= 1000) return (n * Math.pow(1000, u)).toExponential(1).replace('+', '');
  // 1.25k, 12.5k, 804.6k (rounded down so it never shows more than you have)
  const s = n >= 10 ? (Math.floor(n * 10) / 10).toString() : (Math.floor(n * 100) / 100).toString();
  return s + UNITS[u];
}

// "1m 05s" style for short timers.
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return m + 'm' + (s ? ' ' + String(s).padStart(2, '0') + 's' : '');
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}
