
const regex = {
  title_page: /^((?:title|credit|author[s]?|source|notes|draft date|date|contact|copyright)\:)/gim,

  scene_heading: /^((?:\*{0,3}_?)?(?:(?:int|ext|est|i\/e)[. ]).+)|^(?:\.(?!\.+))(.+)/i,
  scene_number: /( *#(.+)# *)/,

  transition: /^((?:FADE (?:TO BLACK|OUT)|CUT TO BLACK)\.|.+ TO\:)|^(?:> *)(.+)/,

  dialogue: /^([A-Z*_]+[0-9A-Z (._\-')]*)(\^?)?(?:\n(?!\n+))([\s\S]+)/,
  parenthetical: /^(\(.+\))$/,

  action: /^(.+)/g,
  centered: /^(?:> *)(.+)(?: *<)(\n.+)*/g,

  section: /^(#+)(?: *)(.*)/,
  synopsis: /^(?:\=(?!\=+) *)(.*)/,

  note: /^(?:\[{2}(?!\[+))(.+)(?:\]{2}(?!\[+))$/,
  note_inline: /(?:\[{2}(?!\[+))([\s\S]+?)(?:\]{2}(?!\[+))/g,
  boneyard: /(^\/\*|^\*\/)$/g,

  page_break: /^\={3,}$/,
  line_break: /^ {2}$/,

  emphasis: /(_|\*{1,3}|_\*{1,3}|\*{1,3}_)(.+)(_|\*{1,3}|_\*{1,3}|\*{1,3}_)/g,
  bold_italic_underline: /(_{1}\*{3}(?=.+\*{3}_{1})|\*{3}_{1}(?=.+_{1}\*{3}))(.+?)(\*{3}_{1}|_{1}\*{3})/g,
  bold_underline: /(_{1}\*{2}(?=.+\*{2}_{1})|\*{2}_{1}(?=.+_{1}\*{2}))(.+?)(\*{2}_{1}|_{1}\*{2})/g,
  italic_underline: /(?:_{1}\*{1}(?=.+\*{1}_{1})|\*{1}_{1}(?=.+_{1}\*{1}))(.+?)(\*{1}_{1}|_{1}\*{1})/g,
  bold_italic: /(\*{3}(?=.+\*{3}))(.+?)(\*{3})/g,
  bold: /(\*{2}(?=.+\*{2}))(.+?)(\*{2})/g,
  italic: /(\*{1}(?=.+\*{1}))(.+?)(\*{1})/g,
  underline: /(_{1}(?=.+_{1}))(.+?)(_{1})/g,

  splitter: /\n{2,}/g,
  cleaner: /^\n+|\n+$/,
  standardizer: /\r\n|\r/g,
  whitespacer: /^\t+|^ {3,}/gm
};

const lexer = function (script) {
  return script.replace(regex.boneyard, '\n$1\n')
    .replace(regex.standardizer, '\n')
    .replace(regex.cleaner, '')
    .replace(regex.whitespacer, '');
};

const tokenize = function (script) {
  let src = lexer(script).split(regex.splitter);
  let i = src.length, line, match, parts, text, meta, x, xlen, dual;
  let tokens = [];

  while (i--) {
    line = src[i];

    // title page
    if (regex.title_page.test(line)) {
      match = line.replace(regex.title_page, '\n$1').split(regex.splitter).reverse();
      for (x = 0, xlen = match.length; x < xlen; x++) {
        parts = match[x].replace(regex.cleaner, '').split(/\:\n*/);
        tokens.push({ type: parts[0].trim().toLowerCase().replace(' ', '_'), text: parts[1].trim() });
      }
      continue;
    }

    // scene headings
    if (match = line.match(regex.scene_heading)) {
      text = match[1] || match[2];

      if (text.indexOf('  ') !== text.length - 2) {
        if (meta = text.match(regex.scene_number)) {
          meta = meta[2];
          text = text.replace(regex.scene_number, '');
        }
        tokens.push({ type: 'scene_heading', text: text, scene_number: meta || undefined });
      }
      continue;
    }

    // centered
    if (match = line.match(regex.centered)) {
      tokens.push({ type: 'centered', text: match[0].replace(/>|</g, '') });
      continue;
    }

    // transitions
    if (match = line.match(regex.transition)) {
      tokens.push({ type: 'transition', text: match[1] || match[2] });
      continue;
    }

    // dialogue blocks - characters, parentheticals and dialogue
    if (match = line.match(regex.dialogue)) {
      if (match[1].indexOf('  ') !== match[1].length - 2) {
        // we're iterating from the bottom up, so we need to push these backwards
        if (match[2]) {
          tokens.push({ type: 'dual_dialogue_end' });
        }

        tokens.push({ type: 'dialogue_end' });

        parts = match[3].split(/(\(.+\))(?:\n+)/).reverse();

        for (x = 0, xlen = parts.length; x < xlen; x++) {
          text = parts[x];

          if (text.length > 0) {
            tokens.push({ type: regex.parenthetical.test(text) ? 'parenthetical' : 'dialogue', text: text });
          }
        }

        tokens.push({ type: 'character', text: match[1].trim() });
        tokens.push({ type: 'dialogue_begin', dual: match[2] ? 'right' : dual ? 'left' : undefined });

        if (dual) {
          tokens.push({ type: 'dual_dialogue_begin' });
        }

        dual = match[2] ? true : false;
        continue;
      }
    }

    // section
    if (match = line.match(regex.section)) {
      tokens.push({ type: 'section', text: match[2], depth: match[1].length });
      continue;
    }

    // synopsis
    if (match = line.match(regex.synopsis)) {
      tokens.push({ type: 'synopsis', text: match[1] });
      continue;
    }

    // notes
    if (match = line.match(regex.note)) {
      tokens.push({ type: 'note', text: match[1] });
      continue;
    }

    // boneyard
    if (match = line.match(regex.boneyard)) {
      tokens.push({ type: match[0][0] === '/' ? 'boneyard_begin' : 'boneyard_end' });
      continue;
    }

    // page breaks
    if (regex.page_break.test(line)) {
      tokens.push({ type: 'page_break' });
      continue;
    }

    // line breaks
    if (regex.line_break.test(line)) {
      tokens.push({ type: 'line_break' });
      continue;
    }

    tokens.push({ type: 'action', text: line });
  }

  return tokens;
};

export function parse(script, callback) {
  let tokens = tokenize(script);
  let output = { tokens: tokens.reverse() };   
  callback(output);
};
