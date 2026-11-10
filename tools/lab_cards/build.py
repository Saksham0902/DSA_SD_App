#!/usr/bin/env python3
"""Inject problem cards into the lab pages.

Usage (from the repo root):
    python3 tools/lab_cards/build.py            # inject cards from every tools/lab_cards/*.txt
    python3 tools/lab_cards/build.py --check    # parse and report, write nothing
    python3 tools/lab_cards/build.py --bump-sw  # also refresh the service-worker cache version

Card files use a small line format:
    == page.html lab-id          start a lab
    -- tabkey | LeetCode 55      start a tab card ('-' for a lab without tabs); the tag after | is optional
    M: cost | sd                 card mode (changes the headings)
    K: keep                      keep the lab's own description line visible
    P: problem statement
    E: example (input -> answer)
    I: the idea
    S: (cur){▲i} what this colour / pointer / stat means   (one line per item, repeatable)
Markup inside text: `code`, **bold**. Swatch states: cur win on ok bad dim hot dep mark land water wall ghost amb out nil;
add ' o' for a round swatch, ' e' for an edge line, ' f' for a filled 'on'. {▲x} is a pointer chip, {text} a label chip.
Macros on an S line: @dbl (the standard doubling-chart explanation).
Running it twice is safe: earlier injections are replaced.
"""
import hashlib, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STATES = {'cur', 'win', 'on', 'ok', 'bad', 'dim', 'hot', 'dep', 'mark', 'land', 'water', 'wall', 'ghost', 'amb', 'out', 'nil'}
MACROS = {
    '@dbl': [
        'Each block is one run. Every **Next** doubles the input size and runs each version again.',
        '{2.0M} how many steps that version took. A longer bar means more work.',
        '{×4.0} how much the steps grew since the block above: ×2 is O(n), a bit over ×2 is O(n log n), ×4 is O(n²), ×8 is O(n³).',
    ],
}


def inline(t):
    """Escape text, then apply `code` and **bold**."""
    out, parts = [], re.split(r'(`[^`]*`)', t)
    for p in parts:
        if len(p) >= 2 and p.startswith('`') and p.endswith('`'):
            c = p[1:-1]
            out.append(('<code class="w">' if len(c) > 24 else '<code>') + html.escape(c, quote=False) + '</code>')
        else:
            e = html.escape(p, quote=False)
            e = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', e)
            out.append(e)
    return ''.join(out)


def plain(t):
    t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)
    return t.replace('`', '')


def item(line, where):
    keys, rest = [], line.strip()
    while rest:
        m = re.match(r'\(([a-z]+)((?: [oef])*)\)\s*', rest)
        if m:
            st = m.group(1)
            if st not in STATES:
                raise SystemExit(f'{where}: unknown swatch state ({st})')
            mods = ''.join(' ' + x for x in m.group(2).split())
            keys.append(f'<i class="lp-sw s-{st}{mods}"></i>')
            rest = rest[m.end():]
            continue
        m = re.match(r'\{([^}]+)\}\s*', rest)
        if m:
            txt = m.group(1)
            cls = 'lp-p' if txt.startswith('▲') else 'lp-c'
            keys.append(f'<span class="{cls}">{html.escape(txt, quote=False)}</span>')
            rest = rest[m.end():]
            continue
        break
    return [''.join(keys), inline(rest)]


def parse(path):
    pages, page, lab, card = {}, None, None, None
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.rstrip('\n')
        where = f'{os.path.basename(path)}:{n}'
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if line.startswith('== '):
            page, lab = line[3:].split()[:2]
            pages.setdefault(page, {}).setdefault(lab, {})
            card = None
            continue
        if line.startswith('-- '):
            if lab is None:
                raise SystemExit(f'{where}: tab before any lab')
            key, _, tag = line[3:].partition('|')
            key = key.strip()
            if key in pages[page][lab]:
                raise SystemExit(f'{where}: duplicate tab {key}')
            card = pages[page][lab][key] = {'s': []}
            if tag.strip():
                card['tag'] = html.escape(tag.strip(), quote=False)
            continue
        m = re.match(r'([MKPEIS]):\s?(.*)$', line)
        if not m or card is None:
            raise SystemExit(f'{where}: cannot read line: {line[:60]}')
        f, v = m.group(1), m.group(2).strip()
        if f == 'M':
            card['m'] = v
        elif f == 'K':
            card['keep'] = 1
        elif f == 'P':
            card['p'] = inline(v)
            first = re.split(r'(?<=[.?!])\s', plain(v), maxsplit=1)[0]
            card['mini'] = html.escape(first, quote=False)
        elif f == 'E':
            card['e'] = inline(v)
        elif f == 'I':
            card['i'] = inline(v)
        elif f == 'S':
            for x in MACROS.get(v, [v]):
                card['s'].append(item(x, where))
    for page_, labs in pages.items():
        for lab_, tabs in labs.items():
            for key, c in tabs.items():
                if not c.get('p'):
                    raise SystemExit(f'{page_} {lab_} {key}: missing P')
                if not c['s']:
                    del c['s']
    return pages


def strip_old(s):
    s = re.sub(r'<!--lp:css-->.*?<!--/lp:css-->\n?', '', s, flags=re.S)
    s = re.sub(r'<!--lp:js-->.*?<!--/lp:js-->\n?', '', s, flags=re.S)
    return s


def bump_sw():
    p = os.path.join(ROOT, 'sw.js')
    sw = open(p, encoding='utf-8').read()
    pre = json.loads(re.search(r'const PRE=(\[.*?\]);', sw, re.S).group(1))
    h = hashlib.sha1()
    for u in pre:
        f = os.path.join(ROOT, u if not u.endswith('/') else u + 'index.html')
        if os.path.isfile(f):
            h.update(open(f, 'rb').read())
    v = 'dojo-' + h.hexdigest()[:10]
    sw2 = re.sub(r"const V='[^']*';", f"const V='{v}';", sw, count=1)
    if sw2 != sw:
        open(p, 'w', encoding='utf-8').write(sw2)
    print('sw.js cache version', v)


def main():
    check = '--check' in sys.argv
    css = open(os.path.join(HERE, 'card.css'), encoding='utf-8').read().strip()
    js = open(os.path.join(HERE, 'card.js'), encoding='utf-8').read().strip()
    allp = {}
    for fn in sorted(os.listdir(HERE)):
        if fn.endswith('.txt'):
            for pg, labs in parse(os.path.join(HERE, fn)).items():
                for lab, tabs in labs.items():
                    if lab in allp.get(pg, {}):
                        raise SystemExit(f'{pg} {lab} appears in two card files')
                    allp.setdefault(pg, {})[lab] = tabs
    total = 0
    for pg in sorted(allp):
        path = os.path.join(ROOT, pg)
        if not os.path.isfile(path):
            raise SystemExit(f'no such page: {pg}')
        s = strip_old(open(path, encoding='utf-8').read())
        ids = re.findall(r'<section class="lab[^"]*" id="([^"]+)"', s)
        missing = [i for i in ids if i not in allp[pg]]
        extra = [i for i in allp[pg] if i not in ids]
        if extra:
            raise SystemExit(f'{pg}: cards for labs that do not exist: {extra}')
        n = sum(len(t) for t in allp[pg].values())
        total += n
        print(f'{pg}: {len(allp[pg])} labs, {n} cards' + (f'  (no cards yet: {", ".join(missing)})' if missing else ''))
        if check:
            continue
        data = json.dumps(allp[pg], ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        s = s.replace('</head>', f'<!--lp:css--><style id="lp-css">{css}</style><!--/lp:css-->\n</head>', 1)
        i = s.rfind('</body>')
        s = s[:i] + f'<!--lp:js--><script id="lp-data">window.LAB_CARDS={data};</script><script id="lp-js">{js}</script><!--/lp:js-->\n' + s[i:]
        open(path, 'w', encoding='utf-8').write(s)
    print(f'{total} cards on {len(allp)} pages' + (' (check only)' if check else ''))
    if '--bump-sw' in sys.argv and not check:
        bump_sw()


if __name__ == '__main__':
    main()
