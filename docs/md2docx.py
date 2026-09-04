#!/usr/bin/env python3
"""Convert voting_system docs markdown to docx (hand-rolled OOXML, keeps 繁體)."""
import sys, os, re, zipfile
import markdown

BASE = '/home/bruce/Documents/voting_system/docs'
DOCS = ['01_requirements', '02_architecture', '03_dev_plan']

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def md_to_blocks(md_text):
    html = markdown.markdown(
        md_text,
        extensions=['tables', 'fenced_code', 'codehilite', 'nl2br'],
        extension_configs={'codehilite': {'guess_lang': False}},
    )
    # Normalize code blocks: <div class="codehilite"><pre>...</pre></div> → <pre>...</pre>
    html = re.sub(r'<div class="codehilite"><pre>(.*?)</pre></div>',
                  r'<pre>\1</pre>', html, flags=re.S)
    html = re.sub(r'<div class="codehilite"><pre><span></span>(.*?)</pre></div>',
                  r'<pre>\1</pre>', html, flags=re.S)
    # Strip any remaining codehilite span markup (syntax coloring)
    html = re.sub(r'<span class="[^"]*">', '', html)
    html = html.replace('</span>', '')
    # Strip remaining <code> wrapper inside pre (keep text)
    html = re.sub(r'(<pre>).*?<code>(.*?)(?:</code>)?</pre>', r'\1\2</pre>', html, flags=re.S)

    blocks = []
    tag_re = re.compile(
        r'<(h1|h2|h3|h4|p|pre|blockquote|ul|ol|table|hr)\b[^>]*>(.*?)</\1>|<hr\s*/>',
        re.S)
    for m in tag_re.finditer(html):
        tag = m.group(1) or 'hr'
        blocks.append((tag, m.group(2) or ''))
    return blocks

def inline_runs(text):
    """Parse inline html (code/b/strong/i/em) into (style, text) runs."""
    runs = []
    i = 0
    tags = ('<code>', '<strong>', '<b>', '<em>', '<i>')
    while i < len(text):
        nxt = len(text)
        which = None
        for t in tags:
            k = text.find(t, i)
            if k != -1 and k < nxt:
                nxt, which = k, t
        if which is None:
            runs.append(('text', text[i:]))
            break
        if text[i:nxt]:
            runs.append(('text', text[i:nxt]))
        close = '</' + which[1:-1] + '>'
        end = text.find(close, nxt + len(which))
        if end == -1:
            runs.append(('text', text[nxt:]))
            break
        style = {'<code>': 'code', '<b>': 'bold', '<strong>': 'bold',
                 '<i>': 'italic', '<em>': 'italic'}[which]
        runs.append((style, text[nxt + len(which):end]))
        i = end + len(close)
    return [(s, t) for s, t in runs if t]

def run_xml(style, text):
    if style == 'code':
        rpr = ('<w:rPr><w:rFonts w:ascii="DejaVu Sans Mono" w:eastAsia="Noto Sans CJK TC" '
               'w:hAnsi="DejaVu Sans Mono"/><w:sz w:val="18"/>'
               '<w:shd w:val="clear" w:fill="F2F2F2"/></w:rPr>')
    elif style == 'bold':
        rpr = '<w:rPr><w:b/></w:rPr>'
    elif style == 'italic':
        rpr = '<w:rPr><w:i/></w:rPr>'
    else:
        rpr = ''
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s)

def parse_table(inner):
    rows = []
    for rm in re.finditer(r'<tr[^>]*>(.*?)</tr>', inner, re.S):
        cells = [cm.group(1) for cm in re.finditer(r'<t[hd][^>]*>(.*?)</t[hd]>', rm.group(1), re.S)]
        rows.append(cells)
    return rows

def cell_xml(content, header=False):
    shd = '<w:shd w:val="clear" w:fill="EEEEEE"/>' if header else ''
    rpr = '<w:rPr><w:b/></w:rPr>' if header else ''
    return (
        '<w:tc><w:tcPr>'
        '<w:tcBorders>'
        '<w:top w:val="single" w:sz="4" w:color="999999"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="999999"/>'
        '<w:left w:val="single" w:sz="4" w:color="999999"/>'
        '<w:right w:val="single" w:sz="4" w:color="999999"/>'
        '</w:tcBorders>' + shd +
        '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>'
        '<w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>'
        '</w:tcPr>'
        '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>'
        f'<w:r>{rpr}<w:t xml:space="preserve">{esc(strip_tags(content))}</w:t></w:r>'
        '</w:p></w:tc>')

def blocks_to_body(blocks):
    parts = []
    for tag, inner in blocks:
        if tag == 'hr':
            parts.append('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" '
                         'w:space="1" w:color="CCCCCC"/></w:pBdr><w:spacing w:after="120"/>'
                         '</w:pPr></w:p>')
        elif tag in ('h1', 'h2', 'h3', 'h4'):
            style = f'Heading{int(tag[1])}'
            runs = ''.join(run_xml('text', t) for _, t in inline_runs(strip_tags(inner)))
            parts.append(f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>{runs}</w:p>')
        elif tag == 'p':
            runs = ''.join(run_xml(s, t) for s, t in inline_runs(inner))
            parts.append(f'<w:p>{runs}</w:p>')
        elif tag == 'pre':
            code = strip_tags(inner)
            for line in code.split('\n'):
                body = esc(line) if line.strip() else ' '
                parts.append(
                    '<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>'
                    f'<w:r><w:rPr><w:rFonts w:ascii="DejaVu Sans Mono" w:eastAsia="Noto Sans CJK TC" '
                    f'w:hAnsi="DejaVu Sans Mono"/><w:sz w:val="18"/></w:rPr>'
                    f'<w:t xml:space="preserve">{body}</w:t></w:r></w:p>')
        elif tag == 'blockquote':
            txt = strip_tags(inner)
            parts.append('<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr>'
                         f'<w:r><w:rPr><w:i/><w:color w:val="555555"/></w:rPr>'
                         f'<w:t xml:space="preserve">{esc(txt)}</w:t></w:r></w:p>')
        elif tag in ('ul', 'ol'):
            idx = 0
            for li in re.finditer(r'<li[^>]*>(.*?)</li>', inner, re.S):
                bullet = '• ' if tag == 'ul' else f'{idx + 1}. '
                idx += 1
                runs = ''.join(run_xml(s, t) for s, t in inline_runs(bullet + li.group(1)))
                parts.append('<w:p><w:pPr><w:ind w:left="480" w:hanging="240"/>'
                             f'<w:spacing w:after="60"/></w:pPr>{runs}</w:p>')
        elif tag == 'table':
            rows = parse_table(inner)
            if not rows:
                continue
            ncols = max(len(r) for r in rows)
            grid = ''.join(f'<w:gridCol w:w="{9000 // ncols}"/>' for _ in range(ncols))
            trs = []
            for ri, row in enumerate(rows):
                tcs = ''.join(cell_xml(c, ri == 0) for c in row)
                trs.append(f'<w:tr>{tcs}</w:tr>')
            parts.append('<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
                         '<w:tblLayout w:type="autofit"/></w:tblPr>'
                         f'<w:tblGrid>{grid}</w:tblGrid>{"".join(trs)}</w:tbl>')
            parts.append('<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>')
    return ''.join(parts)

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal"/>
<w:rPr><w:rFonts w:ascii="Noto Sans CJK TC" w:eastAsia="Noto Sans CJK TC" w:hAnsi="Noto Sans CJK TC"/><w:sz w:val="22"/></w:rPr>
<w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1F3864"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="2E5395"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="25"/><w:color w:val="2E5395"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/>
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="120" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="404040"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code Char"/>
<w:basedOn w:val="Normal"/>
<w:rPr><w:rFonts w:ascii="DejaVu Sans Mono" w:eastAsia="Noto Sans CJK TC" w:hAnsi="DejaVu Sans Mono"/><w:sz w:val="18"/><w:shd w:val="clear" w:fill="F2F2F2"/></w:rPr>
<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="200"/></w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:ind w:left="360"/><w:spacing w:before="80" w:after="80"/></w:pPr>
<w:rPr><w:i/><w:color w:val="555555"/></w:rPr>
</w:style>
</w:styles>"""

def write_docx(out_path, body_xml):
    document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                f'<w:document xmlns:w="{W}"><w:body>{body_xml}'
                '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
                '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" '
                'w:header="720" w:footer="720"/></w:sectPr></w:body></w:document>')
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/_rels/document.xml.rels', DOC_RELS)
        z.writestr('word/document.xml', document)
        z.writestr('word/styles.xml', STYLES)

def main():
    for doc in DOCS:
        md_path = os.path.join(BASE, doc + '.md')
        out_path = os.path.join(BASE, doc + '.docx')
        md_text = open(md_path, encoding='utf-8').read()
        blocks = md_to_blocks(md_text)
        body = blocks_to_body(blocks)
        write_docx(out_path, body)
        size = os.path.getsize(out_path)
        print(f'{doc}.docx  {size:,} bytes  blocks={len(blocks)}  OK')

if __name__ == '__main__':
    main()
