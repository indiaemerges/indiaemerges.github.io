"""Fetch India's national accounts from the MoSPI eSankhyiki API for the indiaemerges National Accounts dashboard.

Writes national-accounts/data/nas.json with values exactly as published (₹ crore).
Run: python tools/fetch_national_accounts.py   (no third-party packages needed)

Series kept:
  b22  2022-23 base, annual and quarterly (MoSPI's current series)
  b11  2011-12 base, annual: back series 1950-51 to 2010-11 joined to the 2011-12 series from 2011-12;
       quarterly from 2011-12. Both are on the same 2011-12 base and published by MoSPI as one series.
For each year and item the latest published estimate is used (e.g. Final over First Revised over Provisional).
Growth rates are not taken from the API: for the 2011-12 series its growth rates are truncated and some come from
older estimates than the levels, so the dashboard calculates every growth rate from the latest published levels.
"""
import concurrent.futures as cf
import datetime as dt
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch_industry import get, num as _num, write_if_changed  # noqa: E402


def num(x):
    v = _num(x)
    return None if v is None or v != v else v  # the API sends 'nan' for values it does not publish

OUT = pathlib.Path(__file__).resolve().parent.parent / "national-accounts" / "data"

REV = ["First Advance Estimates", "Second Advance Estimates", "Provisional Estimates", "First Revised Estimates",
       "Second Revised Estimates", "Third Revised Estimates", "Final Estimates", "Additional Revision"]

TOP = {2: "ntp", 3: "tp", 4: "sub", 5: "gdp", 7: "ndp", 10: "pfce", 11: "gfce", 12: "cis", 13: "val",
       14: "exp", 15: "imp", 16: "pin", 17: "gni", 18: "oct", 19: "gndi"}
TOTAL_LABEL = {1: "gva", 6: "cfc", 8: "gcf", 9: "gfcf", 20: "sav"}

INST = {"Public Non-Financial Corporations": "pnfc", "Private Non-Financial Corporations": "prnfc",
        "Public Financial Corporations": "pfc", "Private Financial Corporations": "prfc",
        "General Government": "gg", "Households Including NPISH": "hh", "Household Sector": "hh"}

# broad sectors as published in the 2022-23 base, with the detailed groups that make them up
BROAD = [
    ("agri", "Agriculture, Livestock, Forestry and Fishing", None),
    ("mining", "Mining and Quarrying", None),
    ("mfg", "Manufacturing", None),
    ("util", "Electricity, Gas, Water Supply & Other Utility Services", None),
    ("cons", "Construction", None),
    ("trade", "Trade, Hotels, Transport, Communication & Services Related to Broadcasting",
     ["Trade, Repair, Hotels and Restaurants", "Transport, Storage, Communication & Services Related to Broadcasting"]),
    ("fin", "Financial, Real Estate & Professional Services",
     ["Financial Services", "Real Estate, Ownership of Dwelling & Professional Services"]),
    ("pub", "Public Administration, Defence & Other Services", ["Public Administration and Defence", "Other Services"]),
]
BROAD_ID = {n: k for k, n, _ in BROAD}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def fy(y):
    y = y.replace("1999-2000", "1999-00")
    return y if re.fullmatch(r"\d{4}-\d{2}", y) else None


def item_id(ind, r):
    """Map a published row to a dashboard item id (None = skip)."""
    if ind in TOP:
        return TOP[ind]
    sec, industry, sub = r.get("institutional_sector"), r.get("industry"), r.get("subindustry")
    base = TOTAL_LABEL.get(ind)
    if ind in (1, 8):
        if sec:
            return base if sec.startswith("Total") else base + "@" + INST[sec]
        if industry is None or industry.startswith("Total"):
            return base
        if sub:
            return base + "." + slug(industry) + "." + slug(sub)
        return base + "." + (BROAD_ID.get(industry) or slug(industry))
    if ind in (6, 9, 20):
        if sec is None or sec.startswith("Total"):
            return base
        return base + "@" + INST[sec]
    if ind in (21, 22):
        if ind == 22:
            return "gdp"
        if industry is None or industry.startswith("Total"):
            return "gva"
        if sub:
            return "gva." + slug(industry) + "." + slug(sub)
        return "gva." + (BROAD_ID.get(industry) or slug(industry))
    return None


NAMES = {}


def remember(iid, ind, r):
    if iid in NAMES:
        return
    industry, sub, sec = r.get("industry"), r.get("subindustry"), r.get("institutional_sector")
    NAMES[iid] = dict(ind=ind, industry=industry, sub=sub, sector=sec)


def fetch(base, series, freq, ind):
    p = dict(base_year=base, frequency_code=freq, indicator_code=ind)
    if base == "2011-12":
        p["series"] = series
    return get("nas/getNASData", p)


def collect(rows, ind, freq, store, growth=False):
    """store[(period, item)] = [rank, cur, con]; keeps the latest revision, merging duplicate total rows."""
    for r in rows:
        y = fy(r["year"])
        if not y:
            continue
        per = y + " " + r["quarter"] if freq == "Quarterly" else y
        iid = item_id(ind, r)
        if iid is None:
            continue
        remember(iid, ind, r)
        rank = REV.index(r["revision"]) if r.get("revision") in REV else -1
        cur, con = num(r["current_price"]), num(r["constant_price"])
        key = (per, iid)
        old = store.get(key)
        if old is None or rank > old[0]:
            store[key] = [rank, cur, con]
        elif rank == old[0]:  # same vintage, e.g. a total published twice: fill gaps only
            if old[1] is None:
                old[1] = cur
            if old[2] is None:
                old[2] = con


def build():
    jobs = []
    for base, series in (("2022-23", "Current"), ("2011-12", "Current"), ("2011-12", "Back")):
        for freq in ("Annually", "Quarterly"):
            if series == "Back" and freq == "Quarterly":
                continue
            for ind in range(1, 21):
                jobs.append((base, series, freq, ind))
    with cf.ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda j: (j, fetch(*j)), jobs))

    stores = {}
    for (base, series, freq, ind), rows in res:
        kind = "g" if ind in (21, 22) else "v"
        key = (base, series, freq, kind)
        collect(rows, ind, freq, stores.setdefault(key, {}), growth=kind == "g")

    out = dict(meta=dict(fetched=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), source="MoSPI National Accounts Statistics via the eSankhyiki API",
                         unit="₹ crore"), a={}, q={}, rev={}, names={})

    def pack(store, periods):
        items = sorted({k[1] for k in store})
        d = {}
        for it in items:
            cur = [store.get((p, it), [None, None, None])[1] for p in periods]
            con = [store.get((p, it), [None, None, None])[2] for p in periods]
            if any(v is not None for v in cur + con):
                d[it] = [cur, con]
        return d

    def periods_of(store):
        return sorted({k[0] for k in store})

    # ---- 2022-23 base
    sa, sq = stores[("2022-23", "Current", "Annually", "v")], stores[("2022-23", "Current", "Quarterly", "v")]
    pa, pq = periods_of(sa), periods_of(sq)
    out["a"]["b22"] = dict(periods=pa, items=pack(sa, pa))
    out["q"]["b22"] = dict(periods=pq, items=pack(sq, pq))
    out["rev"]["b22"] = [REV[sa[(p, "gdp")][0]] if (p, "gdp") in sa and sa[(p, "gdp")][0] >= 0 else None for p in pa]

    # ---- 2011-12 base: back series to 2010-11, then the 2011-12 series
    cur_a, back_a = stores[("2011-12", "Current", "Annually", "v")], stores[("2011-12", "Back", "Annually", "v")]
    # broad tertiary sectors: in the latest vintages MoSPI publishes only their components; use the sum of the
    # published components when every component is published, and record that this was done
    summed = []
    for k, name, parts in BROAD:
        if not parts:
            continue
        for p in sorted({kk[0] for kk in cur_a}):
            comps = [cur_a.get((p, "gva." + slug(c))) for c in parts]
            if all(c and c[1] is not None for c in comps):
                rank = min(c[0] for c in comps)
                old = cur_a.get((p, "gva." + k))
                if old is None or rank > old[0]:
                    con = None if any(c[2] is None for c in comps) else sum(c[2] for c in comps)
                    cur_a[(p, "gva." + k)] = [rank, sum(c[1] for c in comps), con]
                    summed.append(p)
        for p in sorted({kk[0] for kk in back_a}):
            comps = [back_a.get((p, "gva." + slug(c))) for c in parts]
            if all(c and c[1] is not None for c in comps):
                back_a[(p, "gva." + k)] = [-1, sum(c[1] for c in comps), None if any(c[2] is None for c in comps) else sum(c[2] for c in comps)]
    joined = {k: v for k, v in back_a.items() if k[0] < "2011-12"}
    joined.update(cur_a)
    pa11 = periods_of(joined)
    out["a"]["b11"] = dict(periods=pa11, items=pack(joined, pa11), back_to="2010-11")
    out["rev"]["b11"] = [REV[joined[(p, "gdp")][0]] if (p, "gdp") in joined and joined[(p, "gdp")][0] >= 0 else ("Back series" if p < "2011-12" else None) for p in pa11]
    out["meta"]["b11_summed_sectors"] = sorted(set(summed))
    sq11 = stores[("2011-12", "Current", "Quarterly", "v")]
    pq11 = periods_of(sq11)
    out["q"]["b11"] = dict(periods=pq11, items=pack(sq11, pq11))

    out["names"] = NAMES
    out["meta"]["latest"] = dict(b22_q=pq[-1], b22_a=pa[-1], b11_q=pq11[-1], b11_a=pa11[-1])
    return out


# ---------------------------------------------------------------- states (2011-12 base: MoSPI publishes no state series on the 2022-23 base yet)
GEO_NAME = {"Andaman & Nicobar Islands": "Andaman and Nicobar Islands", "Delhi": "NCT Delhi", "Jammu & Kashmir": "Jammu and Kashmir"}
STATE_CODES = ",".join(f"{i:02d}" for i in range(1, 38))


def fetch_states():
    """GSDP, per capita GSDP and GSVA by sector for each state, in ₹ crore.

    MoSPI publishes GSVA, taxes and subsidies in ₹ lakh; they are divided by 100. For states whose GSDP line is
    missing from the API (it carries GSVA, taxes and subsidies for them), GSDP is GSVA + taxes on products -
    subsidies on products, the identity that holds to within ₹0.5 crore for every state that has both."""
    jobs = [23, 31, 29, 33, 34]
    with cf.ThreadPoolExecutor(5) as ex:
        res = dict(zip(jobs, ex.map(lambda i: get("nas/getNASData", dict(base_year="2011-12", series="Current", frequency_code="Annually",
                                                                       indicator_code=i, state_code=STATE_CODES)), jobs)))
    val = {}  # (item, state, year) -> [cur, con]

    def put(item, st, y, cur, con, scale=1.0):
        st = GEO_NAME.get(st, st)
        val[(item, st, y)] = [None if cur is None else round(cur / scale, 2), None if con is None else round(con / scale, 2)]

    for r in res[23]:
        put("gsdp", r["state"], r["year"], num(r["current_price"]), num(r["constant_price"]))
    for r in res[31]:
        put("pcgsdp", r["state"], r["year"], num(r["current_price"]), num(r["constant_price"]))
    for code, item in ((33, "tp"), (34, "sub")):
        for r in res[code]:
            put(item, r["state"], r["year"], num(r["current_price"]), num(r["constant_price"]), 100)
    parts = {k: [slug(c) for c in ps] for k, _, ps in BROAD if ps}
    raw = {}
    for r in res[29]:
        if r.get("subindustry"):
            continue
        # the state tables call public administration and defence just "Public Administration"
        ind = {"Public Administration": "Public Administration and Defence"}.get(r["industry"], r["industry"])
        item = "gsva" if ind.startswith("Total") else "gsva." + (BROAD_ID.get(ind) or slug(ind))
        put(item, r["state"], r["year"], num(r["current_price"]), num(r["constant_price"]), 100)
        raw[(item, GEO_NAME.get(r["state"], r["state"]), r["year"])] = True
    states = sorted({k[1] for k in val})
    years = sorted({k[2] for k in val if fy(k[2])})
    # broad tertiary sectors as the sum of their published parts (MoSPI's state tables give only the parts)
    for k, ps in parts.items():
        for st in states:
            for y in years:
                comps = [val.get(("gsva." + c, st, y)) for c in ps]
                if ("gsva." + k, st, y) not in val and all(comps):
                    cur = None if any(c[0] is None for c in comps) else round(sum(c[0] for c in comps), 2)
                    con = None if any(c[1] is None for c in comps) else round(sum(c[1] for c in comps), 2)
                    val[("gsva." + k, st, y)] = [cur, con]
    derived = {}
    for st in states:
        for y in years:
            g = val.get(("gsdp", st, y))
            if g and g[0] is not None:
                continue
            a, t, s = (val.get((i, st, y)) for i in ("gsva", "tp", "sub"))
            if a and t and s and None not in (a[0], t[0], s[0]):
                con = None if None in (a[1], t[1], s[1]) else round(a[1] + t[1] - s[1], 2)
                val[("gsdp", st, y)] = [round(a[0] + t[0] - s[0], 2), con]
                derived.setdefault(st, []).append(y)
    items = sorted({k[0] for k in val})
    out = dict(meta=dict(fetched=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                         source="MoSPI National Accounts Statistics (state accounts, 2011-12 base) via the eSankhyiki API",
                         unit="₹ crore; per capita GSDP in ₹", gsdp_from_gsva=derived),
               years=years, states=states, v={})
    for it in items:
        cur = [[(val.get((it, st, y)) or [None, None])[0] for y in years] for st in states]
        con = [[(val.get((it, st, y)) or [None, None])[1] for y in years] for st in states]
        out["v"][it] = [cur, con]
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = build()
    write_if_changed(OUT / "nas.json", data)
    sd = fetch_states()
    write_if_changed(OUT / "states.json", sd)
    print("states:", len(sd["states"]), "years", sd["years"][0], "to", sd["years"][-1], "GSDP from GSVA:", sd["meta"]["gsdp_from_gsva"])
    m = data["meta"]["latest"]
    print("latest:", m, "items b22:", len(data["a"]["b22"]["items"]), "b11:", len(data["a"]["b11"]["items"]))


if __name__ == "__main__":
    main()
