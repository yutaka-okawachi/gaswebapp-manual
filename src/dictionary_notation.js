// Display-only transcription of Don Quixote, IMSLP18787, PDF32/printed p.224.
// One black quarter note, downward stem, three tremolo strokes; no pitch implied.
function renderDictionaryNotationText(text, german, source, language, renderText) {
  const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const heading = 'alle in den Bläsern als トレモロ音符 notirten Stellen sind mit Zungenschlag auszuführen.';
  const value = String(text ?? '');
  const render = typeof renderText === 'function' ? renderText : escape;
  // Preserve the quotation and its explicit short-pause meaning; only draw its sign.
  const quote = '𝄐 bedeutet hier nur ein kurzes Anhalten auf dem Taktstrich und nicht etwa eine Fermate.';
  if (String(german ?? '').normalize('NFC').trim() === 'anhalten' && String(source ?? '').includes('[GM]') && value.includes(quote)) {
    const position = value.indexOf(quote), token = '𝄐';
    const label = language === 'en' ? 'Sign for a brief pause at the barline, without a sustained hold' : '小節線上の短い休止を示す記号（長く保持しない）';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 48" width="39" height="48"><path d="M5 28 C8 7 31 7 34 28" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/></svg>';
    const image = '<img class="gm-music-notation dictionary-music-notation" data-notation="short-pause" src="data:image/svg+xml,' + encodeURIComponent(svg) + '" width="39" height="48" alt="' + escape(label) + '" aria-label="' + escape(label) + '" title="' + token + '">';
    return render(value.slice(0, position)) + image + render(value.slice(position + token.length));
  }
  if (String(german ?? '').normalize('NFC').trim() !== heading || String(source ?? '').trim() !== '[RS: Qui]' || value !== String(german ?? '')) return render(value);
  const token = 'トレモロ音符', position = value.indexOf(token), english = language === 'en';
  const label = english ? 'Single quarter note with a downward stem and three tremolo strokes' : '下向き符幹の四分音符1個に斜線3本のトレモロ表記';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50" viewBox="0 0 38 50">' +
    '<ellipse data-note="quarter" cx="25" cy="10" rx="6" ry="4" transform="rotate(-20 25 10)" fill="black"/>' +
    '<path data-stem="single" data-stem-direction="down" d="M20 11 V44" stroke="black" stroke-width="1.7"/>' +
    [0, 6, 12].map(y => '<path data-tremolo-stroke="true" d="M8 ' + (25 + y) + ' L29 ' + (17 + y) + ' V' + (21 + y) + ' L8 ' + (29 + y) + ' Z" fill="black"/>').join('') + '</svg>';
  const image = '<img class="gm-music-notation dictionary-music-notation" data-notation="quarter-tremolo-three" src="data:image/svg+xml,' + encodeURIComponent(svg) + '" width="38" height="50" alt="' + escape(label) + '" aria-label="' + escape(label) + '" title="' + (english ? '[tremolo notes]' : token) + '">';
  return render(value.slice(0, position)) + image + render(value.slice(position + token.length));
}
