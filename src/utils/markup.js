// Turns "**bold**" markers into <strong> and escapes everything else.
export function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function bold(text = '') {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
export function isTodo(text = '') {
  return /\[TODO/.test(String(text));
}
export function fmt(n) {
  return new Intl.NumberFormat('en-GB').format(n);
}
