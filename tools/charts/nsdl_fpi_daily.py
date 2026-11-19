"""Turn NSDL FPI Monitor 'Daily Trends in FPI Investments' monthly downloads (.xls, which are HTML tables)
into one daily CSV for a chart of the day.

Usage: python tools/charts/nsdl_fpi_daily.py OUT.csv mar_fpi.xls apr_fpi.xls ...

Columns: date, net_usd_bn, net_cr, usd_inr, ma5_usd_bn, ma5_cr, then net US$ bn by asset class.
Values are NSDL's own: 'Total' rows for the day, and 'Sub-total' rows per asset class. The US$ figures are
NSDL's, converted at the RBI reference rate it reports. The moving averages are simple means of the last
five reporting dates.
"""
import csv
import html.parser
import re
import sys
from datetime import datetime


class Rows(html.parser.HTMLParser):
    """Collect table rows, expanding rowspan cells (NSDL spans the date, class and rate cells)."""
    def __init__(self):
        super().__init__(); self.rows = []; self.cur = None; self.cell = None; self.span = 1; self.pending = {}
    def handle_starttag(self, tag, a):
        if tag == "tr": self.cur = []
        elif tag in ("td", "th") and self.cur is not None:
            self.cell = []; self.span = int(dict(a).get("rowspan") or 1)
    def _fill(self):
        while len(self.cur) in self.pending:
            col = len(self.cur); val, left = self.pending[col]; self.cur.append(val)
            if left <= 1: del self.pending[col]
            else: self.pending[col] = (val, left - 1)
    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self._fill()
            val = " ".join("".join(self.cell).split()); col = len(self.cur); self.cur.append(val)
            if self.span > 1: self.pending[col] = (val, self.span - 1)
            self.cell = None
        elif tag == "tr" and self.cur is not None:
            self._fill(); self.rows.append(self.cur); self.cur = None
    def handle_data(self, d):
        if self.cell is not None: self.cell.append(d)


def num(s):
    s = s.replace(",", "").replace("Rs.", "").strip()
    if not s: return None
    neg = s.startswith("(") and s.endswith(")")
    try: v = float(s.strip("()"))
    except ValueError: return None
    return -v if neg else v


CLASSES = {"Equity": "equity", "Debt-General Limit": "debt", "Debt-VRR": "debt", "Debt-FAR": "debt",
           "Hybrid": "hybrid", "Mutual Funds": "mutual_funds", "AIFs": "aifs"}


def main(out, files):
    days = {}
    for f in files:
        p = Rows(); p.feed(open(f, encoding="utf-8", errors="ignore").read())
        for r in p.rows:
            if len(r) < 8: continue
            try: d = datetime.strptime(r[0], "%d-%b-%Y").date().isoformat()
            except ValueError: continue
            cls, route = r[1], r[2]
            day = days.setdefault(d, {"cls": {}})
            if route == "Total":
                day.update(net_cr=num(r[5]), net_usdm=num(r[6]), fx=num(r[7]))
            elif route == "Sub-total":
                k = CLASSES.get(cls)
                if k: day["cls"][k] = day["cls"].get(k, 0) + (num(r[6]) or 0)
    dates = sorted(d for d in days if "net_usdm" in days[d])
    keys = ["equity", "debt", "hybrid", "mutual_funds", "aifs"]
    with open(out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "net_usd_bn", "net_cr", "usd_inr", "ma5_usd_bn", "ma5_cr"] + [k + "_usd_bn" for k in keys])
        for i, d in enumerate(dates):
            x = days[d]
            win = [days[dates[j]] for j in range(i - 4, i + 1)] if i >= 4 else None
            ma_u = sum(v["net_usdm"] for v in win) / 5 / 1000 if win else None
            ma_c = sum(v["net_cr"] for v in win) / 5 if win else None
            row = [d, round(x["net_usdm"] / 1000, 5), x["net_cr"], x["fx"],
                   "" if ma_u is None else round(ma_u, 5), "" if ma_c is None else round(ma_c, 2)]
            row += [round(x["cls"].get(k, 0) / 1000, 5) for k in keys]
            w.writerow(row)
    print(f"{len(dates)} reporting dates, {dates[0]} to {dates[-1]} -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
