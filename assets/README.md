# indiaemerges dashboard toolkit

Every dashboard on indiaemerges.com uses these shared files, so a fix or a new feature here reaches every dashboard at once.

| File | What it is |
|---|---|
| `ie.css` | Page layout, type, controls, cards, tiles, tables, tooltip, map row. Black ground, white type; pastel colours only to tell categories apart. |
| `ie.js` | Charts, controls, tooltip, routing and formatting, exposed as `window.IE`. Needs d3 v7 loaded first. |
| `india-geo.js` | India state boundaries (TopoJSON, `window.GEO`) for `IE.mapChart`. Needs topojson-client. |
| `cod.css`, `cod.js` | The interactive chart of the day on the front page. |

## A new dashboard

1. Make a folder, e.g. `/prices/`, with `index.html` and a `data/` folder.
2. Write `tools/fetch_<name>.py` that writes `<folder>/data/*.json` with values exactly as published (reuse `get`, `num` and `write_if_changed` from `tools/fetch_industry.py`).
3. Add `.github/workflows/update-<name>.yml` (copy `update-national-accounts.yml` and change the script and folder names).
4. Add a card to the Dashboards section of the front page.
5. If the data has state figures, add a map view: `IE.mapChart` beside `IE.rankBars`, with a year slider (`IE.yearCtl` with `{play:true}`) and a state profile below.

Page skeleton:

```html
<link rel="stylesheet" href="/assets/ie.css">
...
<header class="top">
  <a class="home" href="/">← <span class="fl">india</span><span class="em">emerges</span></a>
  <h1>Title</h1><p class="sub">One line on what it shows.</p><p class="asof" id="asof"></p>
  <nav class="tabs" id="tabs" aria-label="Views"></nav>
</header>
<div class="bar" id="bar"></div>
<main id="main"><p class="empty">Loading data…</p></main>
<footer class="sitefoot">An <a href="/">indiaemerges.com</a> dashboard · Data: …</footer>
<div id="tip" role="status"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script src="/assets/ie.js"></script>
```

Views use `IE.router(views, start, render, {onResize})`; `render()` draws tabs (`R.tabs(el)`), controls into `#bar`, then the view into `#main`. Each chart is a `.card`: `h3` title first, then legend, then the chart, then notes (`p.note`) below, so a screenshot of title plus chart stands on its own.

## Charts

All time charts take `labels` (one per period), points as `[index, value]`, `kind` (number format), `unit` (shown in the tooltip) and these axis options:

- `align(i)`: a number per label used to place ticks on round periods (years: `+label.slice(0,4)`; quarters: `year*4+q`; months: `year*12+m`).
- `steps: IE.YEAR_STEPS` for annual data, so ticks land on round years (1990-91, 2000-01, …).
- `minStep`, `tickLabel(i)`, `tipTitle(i)`.
- `bands: [{from, to, label, op}]` shades periods, e.g. revised and budget estimates.

| Function | Use |
|---|---|
| `IE.lineChart(el, {series, …})` | Levels and shares over time. `series: [{name, short, color, pts, dash, bold}]`. |
| `IE.growthChart(el, {series, …})` | Any growth rate. Adds a Bars, Lines switch, remembered across the site; every series is drawn as bars or as lines. |
| `IE.barChart(el, {series, lines, …})` | Grouped bars with optional lines on top. |
| `IE.colChart(el, {vals, …})` | One series of columns. |
| `IE.stackChart(el, {keys, line, …})` | Stacked columns, negatives below zero; optional white line (e.g. total growth). |
| `IE.comboChart(el, …)` | Daily bars with positive and negative colours and moving-average lines (chart of the day). |
| `IE.rankBars(el, {items, …})` | Ranked horizontal bars; `ref` draws a white tick, `onClick` makes rows selectable. |
| `IE.scatterChart(el, {pts, xkind, ykind, xTitle, tipHtml, onClick})` | Bubbles sized by `size`, labelled by `label`. |
| `IE.mapChart(el, {values, cl, kind, lookup, tipHtml, onClick, labels, labelFmt})` | India by state, colour classes from `IE.classer`, with each state's value written on it (`IE.fmtShort`). A label sits where it fits inside the state; small states get a callout into the sea or beyond the border; labels that would collide are left off and stay in the tooltip. Use it wherever a dataset has state figures, beside a ranking (`IE.rankBars`) so every value is readable. |
| `IE.classer(values, div)` | Map colour classes: sequential quantiles, or diverging around zero (`{pool}` fixes the bands across years). `IE.scaleLegend` draws its key. |
| `IE.spark(vals)` | Small trend line for tiles. |

**Copy as CSV on every chart.** Every chart above, drawn inside a `.card`, adds a *Copy as CSV* button at the bottom of that card. The button copies exactly the numbers the chart draws, with periods labelled as in the tooltip (`tipTitle`) and the unit in the header. A card with two charts copies both, one after the other. A `null` header falls back to the card's title. To leave a card without the button, give it `data-nocsv`. Charts outside a card (the chart of the day) get no button. For your own drawing code, call `IE.csvOf(el, head, rows)` to join in.

`lineChart` also takes `hlines: [{v, label, short}]` (dashed reference lines whose labels avoid the data) and per-series `endValue` (prints the latest value above the line's last point).

Number kinds for `IE.fmt` and axes: `pct`, `pct2` (two decimals below 10%), `pctx` (always two decimals), `pp`, `cr` (₹ crore, lakh crore), `rs` (₹), `num` and `pop` (lakh, crore), `idx`, `x`.

## Controls and helpers

`IE.ctl(label, el)`, `IE.sel(options, current, onChange)` (option groups allowed), `IE.seg` (button group), `IE.chips` (pick up to N series), `IE.yearCtl(labels, i, on, tag, {play})`, `IE.rangeCtl(labels, a, b, on, title)`, `IE.table`, `IE.copyBtn` + `IE.toCSV`, `IE.legend`, `IE.store` (localStorage), `IE.h` (make elements), `IE.esc`.

The tooltip (`IE.tip`) hides by itself on phones when the reader scrolls, taps elsewhere or lifts their finger for three seconds.

## Colours

`IE.PAL` holds the category colours in a fixed order: cyan, yellow, pink, violet, green, white, orange, grey. Give each category the same colour every time it appears, and use white for totals and all-India lines.
