"""Fetch IIP and ASI data from the MoSPI eSankhyiki API for the indiaemerges Industry dashboard.

Writes industry/data/iip.json and industry/data/asi.json with values exactly as published.
Run: python tools/fetch_industry.py   (no third-party packages needed)
"""
import concurrent.futures as cf
import datetime as dt
import json
import pathlib
import time
import urllib.parse
import urllib.request

API = "https://api.mospi.gov.in/api"
OUT = pathlib.Path(__file__).resolve().parent.parent / "industry" / "data"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]

# ASI indicator codes kept for the dashboard (MoSPI ASI, NIC-2008 series)
ASI_IND = [1, 2, 3, 5, 6, 7, 9, 10, 13, 15, 17, 18, 19, 20, 21, 23, 28, 29, 30, 31, 32, 33, 34, 35,
           37, 38, 42, 43, 45, 46, 57]
ASI_STATE_NIC_IND = [19, 31, 2, 15]   # GVA, persons engaged, factories in operation, output


def get(path, params, tries=5):
    q = dict(params, Format="JSON", limit=200)
    out, page = [], 1
    while True:
        q["page"] = page
        url = f"{API}/{path}?{urllib.parse.urlencode(q, safe=',')}"
        for k in range(tries):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "indiaemerges-data/1.0"})
                with urllib.request.urlopen(req, timeout=90) as r:
                    j = json.loads(r.read())
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


def num(x):
    if x in (None, "", "-", "NA"):
        return None
    try:
        v = float(x)
    except ValueError:
        return None
    return int(v) if v.is_integer() else v


# ---------------------------------------------------------------- IIP
def fetch_iip():
    this_year = dt.date.today().year
    jobs = []
    for base, y0 in (("2022-23", 2023), ("2011-12", 2012)):
        for y in range(y0, this_year + 1):
            jobs.append(("iip/getIIPMonthly", dict(base_year=base, frequency="Monthly", type="All", year=y)))
        jobs.append(("iip/getIIPAnnual", dict(base_year=base, frequency="Annually", type="All")))
    with cf.ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda j: (j, get(*j)), jobs))

    series, monthly, annual = {}, {}, {}

    def sid(r):
        key = (r["base_year"], r["type"], r["category"], r.get("sub_category") or "")
        if key not in series:
            series[key] = dict(id=f"s{len(series)}", base=key[0], type=key[1], cat=key[2], sub=key[3])
        return series[key]["id"]

    for (path, p), rows in res:
        for r in rows:
            k = sid(r)
            idx, g = num(r.get("index")), num(r.get("growth_rate"))
            if path == "iip/getIIPMonthly":
                ym = f'{int(r["year"])}-{MONTHS.index(r["month"]) + 1:02d}'
                monthly.setdefault(k, {})[ym] = [idx, g]
            else:
                annual.setdefault(k, {})[r["year"]] = [idx, g]
    latest = {}
    for s in series.values():
        if s["type"] == "General" and s["id"] in monthly:
            latest[s["base"]] = max(monthly[s["id"]])
    return dict(
        meta=dict(source="MoSPI, Index of Industrial Production (eSankhyiki API)",
                  url="https://esankhyiki.mospi.gov.in", fetched=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                  latest_month=latest),
        series=list(series.values()),
        monthly={k: sorted([[m] + v for m, v in d.items()]) for k, d in monthly.items()},
        annual={k: sorted([[y] + v for y, v in d.items()]) for k, d in annual.items()},
    )


# ---------------------------------------------------------------- ASI
def fetch_asi():
    base = dict(classification_year=2008, sector_code="Combined")
    jobs = []
    for i in ASI_IND:   # All-India by 2-digit NIC
        jobs.append(("nic", dict(base, indicator_code=i, state_code=99, nic_type="2-digit")))
    for i in ASI_IND:   # each state, all industries
        jobs.append(("state", dict(base, indicator_code=i, nic_code=99999, nic_type="2-digit")))
    for i in ASI_STATE_NIC_IND:   # each state by 2-digit NIC
        jobs.append(("state_nic", dict(base, indicator_code=i, nic_type="2-digit")))
    with cf.ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda j: (j[0], get("asi/getASIData", j[1])), jobs))

    years, inds, nics = set(), {}, {}
    nic, state, state_nic = {}, {}, {}
    for kind, rows in res:
        for r in rows:
            y, v = r["year"], num(r["value"])
            years.add(y)
            name = r["indicator"].strip()
            inds.setdefault(name, r.get("unit") or "")
            if r["nic_code"] not in ("99999", "99998"):
                nics[r["nic_code"]] = r["nic_description"].strip()
            if kind == "nic" and r["state"] == "All India":
                nic.setdefault(r["nic_code"], {}).setdefault(name, {})[y] = v
            elif kind == "state" and r["nic_code"] == "99999":
                state.setdefault(r["state"].strip(), {}).setdefault(name, {})[y] = v
            elif kind == "state_nic" and r["nic_code"] not in ("99999",):
                state_nic.setdefault(r["state"].strip(), {}).setdefault(r["nic_code"], {}).setdefault(name, {})[y] = v
    years = sorted(years)

    def arr(d):
        return [d.get(y) for y in years]

    return dict(
        meta=dict(source="MoSPI, Annual Survey of Industries, NIC-2008 series (eSankhyiki API)",
                  url="https://esankhyiki.mospi.gov.in", fetched=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                  latest_year=years[-1]),
        years=years,
        indicators=[dict(name=n, unit=u) for n, u in inds.items()],
        nic=[dict(code=c, name=nics[c]) for c in sorted(nics)],
        india_nic={c: {n: arr(v) for n, v in d.items()} for c, d in nic.items() if c not in ("99999", "99998")},
        states={s: {n: arr(v) for n, v in d.items()} for s, d in state.items()},
        state_nic={s: {c: {n: arr(v) for n, v in dd.items()} for c, dd in d.items()} for s, d in state_nic.items()},
    )


REVISIONS = ["First Advance Estimates", "Second Advance Estimates", "Provisional Estimates",
             "First Revised Estimates", "Second Revised Estimates", "Third Revised Estimates",
             "Final Estimates", "Additional Revision"]


def fetch_gdp_deflator():
    """Implicit GDP deflator (2011-12 = 100) from MoSPI national accounts, latest revision per year."""
    out = {}
    for series in ("Back", "Current"):
        rows = get("nas/getNASData", dict(base_year="2011-12", series=series, frequency_code="Annually", indicator_code=5))
        best = {}
        for r in rows:
            y = r["year"].replace("1999-2000", "1999-00")
            rank = REVISIONS.index(r["revision"]) if r.get("revision") in REVISIONS else -1
            if y not in best or rank > best[y][0]:
                best[y] = (rank, num(r["current_price"]), num(r["constant_price"]))
        for y, (_, cur, con) in best.items():
            if cur and con and (series == "Current" or y not in out):
                out[y] = round(cur / con * 100, 4)
    return dict(sorted(out.items()))


def write_if_changed(path, data):
    """Write only when the numbers changed, so the 'fetched' stamp marks a real data update."""
    if path.exists():
        old = json.loads(path.read_text())
        a, b = dict(old, meta=dict(old["meta"], fetched=None)), dict(data, meta=dict(data["meta"], fetched=None))
        if a == b:
            print(path.name, "unchanged")
            return
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(path.name, "updated")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    t = time.time()
    iip = fetch_iip()
    write_if_changed(OUT / "iip.json", iip)
    print("IIP:", len(iip["series"]), "series; latest", iip["meta"]["latest_month"], f"{time.time()-t:.0f}s")
    asi = fetch_asi()
    asi["gdp_deflator"] = fetch_gdp_deflator()
    asi["meta"]["deflator_source"] = "MoSPI National Accounts, 2011-12 base: GDP at current / constant prices"
    write_if_changed(OUT / "asi.json", asi)
    print("ASI:", asi["years"][0], "to", asi["years"][-1], len(asi["states"]), "states", f"{time.time()-t:.0f}s")


if __name__ == "__main__":
    main()
