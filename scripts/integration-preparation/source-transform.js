"use strict";

// Replace one Java method body, ignoring quoted braces and comments.
function replaceJavaBody(source, signature, body) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error('Missing source anchor: ' + signature);
  const open = source.indexOf('{', start + signature.length);
  let depth = 1, quote = '', lineComment = false, blockComment = false;
  for (let i = open + 1; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockComment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(0, open + 1) + '\n' + body + '\n    ' + source.slice(i);
  }
  throw new Error('Unclosed source body: ' + signature);
}
module.exports = { replaceJavaBody };
