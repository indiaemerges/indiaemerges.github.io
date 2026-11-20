"""Fetch India's consumer and wholesale price indices from the MoSPI eSankhyiki API for the indiaemerges Prices dashboard.

Writes prices/data/cpi.json (2024 base, refreshed every run), prices/data/cpi12.json (2012 base, closed in December
2025), prices/data/wpi.json (2022-23 base, refreshed) and prices/data/wpi11.json (2011-12 base, closed).
Index values and CPI inflation rates are exactly as published. The closed series are fetched once and kept.
Run: python tools/fetch_prices.py   (no third-party packages needed)
"""
import concurrent.futures as cf
import datetime as dt
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch_industry import num as _num, write_if_changed  # noqa: E402

API = "https://api.mospi.gov.in/api"


def get(path, params, tries=5):
    """All pages of one API query. The CPI endpoints allow 100 records a page, the WPI one 200."""
    q = dict(params, Format="JSON", limit=100 if path.startswith("cpi/") else 200)
    out, page = [], 1
    while True:
        q["page"] = page
        url = f"{API}/{path}?{urllib.parse.urlencode(q, safe=',')}"
        for k in range(tries):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "indiaemerges-data/1.0"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    j = json.loads(r.read())
                if "error" in j:
                    raise RuntimeError(j["error"])
                break
            except Exception as e:  # network hiccups: back off and retry
                if k == tries - 1:
                    raise RuntimeError(f"{url}: {e}")
                time.sleep(2 * (k + 1))
        data = j.get("data") or []
        out += data
        md = j.get("meta_data") or {}
        if not data or page >= int(md.get("totalPages", 1)):
            return out
        page += 1


OUT = pathlib.Path(__file__).resolve().parent.parent / "prices" / "data"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
SECT = {"Rural": "R", "Urban": "U", "Combined": "C"}
THIS_YEAR = dt.date.today().year


def num(x):
    v = _num(x)
    return None if v is None or v != v else v


def ym(r):
    return f"{int(r['year'])}-{MONTHS.index(r['month']) + 1:02d}"


def pool(jobs, fn, n=6):
    with cf.ThreadPoolExecutor(n) as ex:
        return list(ex.map(fn, jobs))


def stamp():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def series_table(rows, key, months):
    """rows: dict key -> {month: value}; returns key -> list aligned to months."""
    return {k: [v.get(m) for m in months] for k, v in rows.items()}


# ---------------------------------------------------------------- CPI, 2024 base
CPI_LEVELS = ["division", "group", "class", "sub_class", "item"]


def cpi24():
    jobs = [(y, s) for y in range(2025, THIS_YEAR + 1) for s in (1, 2, 3)]
    res = pool(jobs, lambda j: get("cpi/getCPIData", dict(base_year="2024", series="Current", year=j[0], state_code=1, sector_code=j[1])))
    nodes, idx, inf = {}, {}, {}
    for rows in res:
        for r in rows:
            path = [r.get(l) for l in CPI_LEVELS]
            depth = max(i for i, v in enumerate(path) if v) if any(path) else 0
            code = r.get("code") or "0"
            sec = SECT[r["sector"]]
            if sec != "C" and depth >= 3:   # rural and urban: down to class level only, to keep the file small
                continue
            if code not in nodes:
                parent = code.rsplit(".", 1)[0] if "." in code else ("0" if code != "0" else None)
                nodes[code] = dict(code=code, name=path[depth] if code != "0" else "All items (CPI General)", level=depth if code != "0" else -1, parent=parent)
            m = ym(r)
            idx.setdefault((code, sec), {})[m] = num(r["index"])
            if r.get("inflation") not in (None, ""):
                inf.setdefault((code, sec), {})[m] = num(r["inflation"])
    months = sorted({m for d in idx.values() for m in d})
    # states: headline index only (the API returns each state's whole tree for any other filter)
    st_jobs = [(y, s) for y in range(2025, THIS_YEAR + 1) for s in (1, 2, 3)]
    st_res = pool(st_jobs, lambda j: get("cpi/getCPIData", dict(base_year="2024", series="Current", year=j[0], division_code=0,
                                                                state_code=",".join(str(i) for i in range(2, 38)), sector_code=j[1])))
    sidx, sinf = {}, {}
    for rows in st_res:
        for r in rows:
            k = (r["state"], SECT[r["sector"]])
            sidx.setdefault(k, {})[ym(r)] = num(r["index"])
            if r.get("inflation") not in (None, ""):
                sinf.setdefault(k, {})[ym(r)] = num(r["inflation"])
    # back series: all-India headline, 2013 to 2024, on the 2024 base
    back = pool([1, 2, 3], lambda s: get("cpi/getCPIData", dict(base_year="2024", series="Back", state_code=1, division_code=0, sector_code=s)))
    bidx, binf = {}, {}
    for rows in back:
        for r in rows:
            s = SECT[r["sector"]]
            bidx.setdefault(s, {})[ym(r)] = num(r["index"])
            if r.get("inflation") not in (None, ""):
                binf.setdefault(s, {})[ym(r)] = num(r["inflation"])
    bmonths = sorted({m for d in bidx.values() for m in d})

    def pack(ix, nf, mons):
        out = {}
        for (k, s), d in ix.items():
            e = out.setdefault(k, {})
            e[s] = [d.get(m) for m in mons]
            if (k, s) in nf:
                e["i" + s] = [nf[(k, s)].get(m) for m in mons]
        return out
    states = sorted({k[0] for k in sidx})
    return dict(meta=dict(fetched=stamp(), source="MoSPI Consumer Price Index, 2024 base, via the eSankhyiki API", latest=months[-1]),
                months=months, nodes=sorted(nodes.values(), key=lambda n: [int(x) for x in n["code"].split(".")] if n["code"] != "0" else [-1]),
                ai=pack(idx, inf, months), states=states,
                st={st: {s: dict(idx=[sidx.get((st, s), {}).get(m) for m in months], inf=[sinf.get((st, s), {}).get(m) for m in months]) for s in "RUC"} for st in states},
                back=dict(months=bmonths, **{s: [bidx.get(s, {}).get(m) for m in bmonths] for s in "RUC"},
                          **{"i" + s: [binf.get(s, {}).get(m) for m in bmonths] for s in "RUC"}))


# ---------------------------------------------------------------- CPI, 2012 base (closed)
def cpi12():
    years = range(2011, 2026)
    jobs = [(y, s) for y in years for s in (1, 2, 3)]
    ai = pool(jobs, lambda j: get("cpi/getCPIIndex", dict(base_year="2012", series="Current", year=j[0], state_code=99, sector_code=j[1])))
    st = pool(jobs, lambda j: get("cpi/getCPIIndex", dict(base_year="2012", series="Current", year=j[0], group_code=0, sector_code=j[1],
                                                         state_code=",".join(str(i) for i in range(1, 37)))))
    idx, inf, sidx, sinf, names = {}, {}, {}, {}, {}
    for rows in ai:
        for r in rows:
            k = (r["subgroup"], SECT[r["sector"]])
            names[r["subgroup"]] = r["group"]
            idx.setdefault(k, {})[ym(r)] = num(r["index"])
            if r.get("inflation") not in (None, ""):
                inf.setdefault(k, {})[ym(r)] = num(r["inflation"])
    for rows in st:
        for r in rows:
            k = (r["state"], SECT[r["sector"]])
            sidx.setdefault(k, {})[ym(r)] = num(r["index"])
            if r.get("inflation") not in (None, ""):
                sinf.setdefault(k, {})[ym(r)] = num(r["inflation"])
    months = sorted({m for d in idx.values() for m in d})
    states = sorted({k[0] for k in sidx})
    return dict(meta=dict(fetched=stamp(), source="MoSPI Consumer Price Index, 2012 base, via the eSankhyiki API", latest=months[-1]),
                months=months, groups=[dict(name=k, group=v) for k, v in names.items()],
                ai={g: {**{s: [idx.get((g, s), {}).get(m) for m in months] for s in "RUC"}, **{"i" + s: [inf.get((g, s), {}).get(m) for m in months] for s in "RUC"}} for g in names},
                states=states,
                st={x: {s: dict(idx=[sidx.get((x, s), {}).get(m) for m in months], inf=[sinf.get((x, s), {}).get(m) for m in months]) for s in "RUC"} for x in states})


# ---------------------------------------------------------------- WPI
WPI_LEVELS = {"2022-23": ["major_group", "group", "sub_group", "sub_sub_group", "item"],
              "2011-12": ["majorgroup", "group", "subgroup", "sub_subgroup", "item"]}


def wpi(base, years, keep_items):
    levels = WPI_LEVELS[base]
    jobs = [(y, m) for y in years for m in range(1, 13)]
    res = pool(jobs, lambda j: get("wpi/getWpiRecords", dict(base_year=base, year=j[0], month_code=j[1])), n=6)
    nodes, idx = {}, {}
    for rows in res:
        for r in rows:
            path = [(r.get(l) or "").strip() for l in levels]
            depth = max([i for i, v in enumerate(path) if v] or [0])
            if depth == 4 and not keep_items:
                continue
            key = " | ".join(p for p in path[:depth + 1] if p)
            if key not in nodes:
                parent = " | ".join(p for p in path[:depth] if p) or None
                nodes[key] = dict(id=key, name=path[depth], level=depth, parent=parent)
            idx.setdefault(key, {})[ym(r)] = num(r["index_value"])
    return nodes, idx


def wpi_file(base, nodes, idx, src):
    months = sorted({m for d in idx.values() for m in d})
    order = list(nodes)
    return dict(meta=dict(fetched=stamp(), source=src, latest=months[-1], base=base), months=months,
                nodes=[nodes[k] for k in order], idx={k: [idx[k].get(m) for m in months] for k in order})


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    c = cpi24()
    write_if_changed(OUT / "cpi.json", c)
    print("CPI 2024 base to", c["meta"]["latest"], len(c["nodes"]), "lines;", len(c["states"]), "states; back series",
          c["back"]["months"][0], "to", c["back"]["months"][-1])
    if not (OUT / "cpi12.json").exists():
        c12 = cpi12()
        write_if_changed(OUT / "cpi12.json", c12)
        print("CPI 2012 base", c12["months"][0], "to", c12["meta"]["latest"])
    # WPI 2022-23 base: refetch the last two years every run (MoSPI revises the latest months), keep earlier months
    path = OUT / "wpi.json"
    old = json.loads(path.read_text()) if path.exists() else None
    first = 2023 if old is None else THIS_YEAR - 1
    nodes, idx = wpi("2022-23", range(first, THIS_YEAR + 1), True)
    if old:
        on = {n["id"]: n for n in old["nodes"]}
        for k, arr in old["idx"].items():
            for m, v in zip(old["months"], arr):
                if v is not None and int(m[:4]) < first:
                    idx.setdefault(k, {})[m] = v
            if k not in nodes:
                nodes[k] = on[k]
    w = wpi_file("2022-23", nodes, idx, "MoSPI and DPIIT Wholesale Price Index, 2022-23 base, via the eSankhyiki API")
    write_if_changed(path, w)
    print("WPI 2022-23 base", w["months"][0], "to", w["meta"]["latest"], len(w["nodes"]), "lines")
    if not (OUT / "wpi11.json").exists():
        n11, i11 = wpi("2011-12", range(2012, 2026), False)
        w11 = wpi_file("2011-12", n11, i11, "MoSPI and DPIIT Wholesale Price Index, 2011-12 base, via the eSankhyiki API")
        write_if_changed(OUT / "wpi11.json", w11)
        print("WPI 2011-12 base", w11["months"][0], "to", w11["meta"]["latest"], len(w11["nodes"]), "lines")


if __name__ == "__main__":
    main()
