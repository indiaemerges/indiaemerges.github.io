"""Rebuild the "Chart of the day" block on the front page and the chart archive page.

Reads charts/charts.json (newest entry = chart of the day). Each entry:
  {"date": "YYYY-MM-DD", "file": "image in charts/", "title": "...", "caption": "...",
   "alt": "what the chart shows, for screen readers", "source": "...",
   "file_mobile": "optional portrait version shown on phones (e.g. 1080x1350)"}

Run: python tools/update_charts.py   (the GitHub Action runs it whenever charts/ changes)
"""
import datetime as dt
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHARTS = ROOT / "charts"
E = html.escape


def nice_date(d):
    d = dt.date.fromisoformat(d)
    return f"{d.day} {d:%B %Y}"


def load():
    items = json.loads((CHARTS / "charts.json").read_text(encoding="utf-8"))
    for it in items:
        for k in ("date", "file", "title", "alt"):
            if not it.get(k):
                sys.exit(f"charts.json: an entry is missing '{k}'")
        for k in ("file", "file_mobile"):
            if it.get(k) and not (CHARTS / it[k]).exists():
                sys.exit(f"charts.json: image charts/{it[k]} not found")
    return sorted(items, key=lambda x: x["date"], reverse=True)


def picture(it):
    img = f'<img src="/charts/{E(it["file"])}" alt="{E(it["alt"])}" loading="lazy">'
    if it.get("file_mobile"):
        img = f'<picture><source media="(max-width: 640px)" srcset="/charts/{E(it["file_mobile"])}">{img}</picture>'
    return f'<a href="/charts/{E(it["file"])}">{img}</a>'


def interactive(it):
    """Interactive version (title first, then controls, legend, chart); the static image is the fallback."""
    spec = dict(it["interactive"], title=it["title"])
    if not spec["data"].startswith("/"):
        spec["data"] = "/charts/" + spec["data"]
    return (f'<div class="cod-int" data-spec="{html.escape(json.dumps(spec, ensure_ascii=False), quote=True)}">'
            f'<h3>{E(it["title"])}</h3><div class="ctls cod-ui"></div><div class="legend cod-legend"></div>'
            f'<div class="plot"><div class="cod-fallback">{picture(it)}</div><div class="cod-plot"></div></div></div>')


def visual(it):
    return interactive(it) if it.get("interactive") else picture(it)


def front_block(it):
    src = f'<p class="cod-src">Source: {E(it["source"])}</p>' if it.get("source") else ""
    cap = f'<p class="cod-cap">{E(it["caption"])}</p>' if it.get("caption") else ""
    sub = f'<p class="cod-sub">{E(it["subtitle"])}</p>' if it.get("subtitle") and it.get("interactive") else ""
    return f'''    <div class="sh"><h2 id="h-chart">Chart of the day</h2><a href="/charts/">All charts →</a></div>
    <figure class="cod">
      {visual(it)}
      <figcaption>
        <time datetime="{it["date"]}">{nice_date(it["date"])}</time>
        {sub}
        {cap}
        {src}
      </figcaption>
    </figure>'''


def archive_page(items):
    cards = "\n".join(f'''    <figure class="arc" id="{it["date"]}">
      <time datetime="{it["date"]}">{nice_date(it["date"])}</time>
      {'' if it.get("interactive") else f'<h2>{E(it["title"])}</h2>'}
      {visual(it)}
      {f'<p class="sub2">{E(it["subtitle"])}</p>' if it.get("subtitle") and it.get("interactive") else ''}
      {f'<p>{E(it["caption"])}</p>' if it.get("caption") else ''}
      {f'<p class="src">Source: {E(it["source"])}</p>' if it.get("source") else ''}
    </figure>''' for it in items)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Charts · indiaemerges</title>
<meta name="description" content="Every indiaemerges chart of the day, newest first.">
<link rel="canonical" href="https://indiaemerges.com/charts/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/ie.css">
<link rel="stylesheet" href="/assets/cod.css">
<style>
.arcs{{display:grid;gap:56px;margin-top:28px;max-width:1100px}}
.arc{{margin:0}}
.arc time{{color:var(--ink3);font-size:15px}}
.arc h2{{margin:4px 0 14px}}
.arc img{{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:10px}}
.arc p{{color:var(--ink2);max-width:72ch;margin:12px 0 0}}
.arc p.src{{color:var(--ink3);font-size:15px;margin-top:6px}}
.arc .cod-int h3{{font-size:clamp(24px,3vw,30px)}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="home" href="/">← india<span>emerges</span></a>
    <h1>Charts</h1>
    <p class="sub">Every chart of the day, newest first. Select a chart to open it at full size.</p>
  </header>
  <main class="arcs">
{cards}
  </main>
  <footer class="sitefoot">An <a href="/">indiaemerges.com</a> page · Contact: <a href="mailto:forgingindia@indiaemerges.com">forgingindia@indiaemerges.com</a></footer>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script src="/assets/ie.js"></script>
<script src="/assets/cod.js"></script>
</body>
</html>
'''


def main():
    items = load()
    page = (ROOT / "index.html").read_text(encoding="utf-8")
    new, n = re.subn(r"(<!-- CHART:START -->\n).*?(\n\s*<!-- CHART:END -->)",
                     lambda m: m.group(1) + front_block(items[0]) + m.group(2), page, flags=re.S)
    if n != 1:
        sys.exit("CHART markers not found in index.html")
    if new != page:
        (ROOT / "index.html").write_text(new, encoding="utf-8")
    (CHARTS / "index.html").write_text(archive_page(items), encoding="utf-8")
    print(f"Chart of the day: {items[0]['date']} {items[0]['title']} ({len(items)} in archive)")


if __name__ == "__main__":
    main()
