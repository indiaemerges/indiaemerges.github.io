"""Refresh the "Writing" list on the indiaemerges front page from the Substack feed.

Rewrites everything between <!-- POSTS:START --> and <!-- POSTS:END --> in index.html.
Run locally with `python tools/update_posts.py`, or let the GitHub Action run it daily.
"""
import email.utils
import html
import pathlib
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

FEED = "https://indiaemerges.substack.com/feed"
PAGE = pathlib.Path(__file__).resolve().parent.parent / "index.html"
MAX_POSTS = 6


def fetch_posts():
    req = urllib.request.Request(FEED, headers={"User-Agent": "indiaemerges-site/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        root = ET.fromstring(r.read())
    posts = []
    for it in root.find("channel").findall("item"):
        d = email.utils.parsedate_to_datetime(it.findtext("pubDate"))
        posts.append({
            "title": html.unescape(it.findtext("title") or "").strip(),
            "sub": html.unescape(it.findtext("description") or "").strip(),
            "url": (it.findtext("link") or "").strip(),
            "date": d,
        })
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts[:MAX_POSTS]


def render(posts):
    out = []
    for p in posts:
        out.append(
            '      <li class="post">\n'
            f'        <time datetime="{p["date"]:%Y-%m-%d}">{p["date"].day} {p["date"]:%b %Y}</time>\n'
            f'        <a href="{html.escape(p["url"])}">{html.escape(p["title"])}</a>\n'
            f'        <p>{html.escape(p["sub"])}</p>\n'
            '      </li>'
        )
    return "\n".join(out)


def main():
    posts = fetch_posts()
    if not posts:
        sys.exit("Feed returned no posts; page left unchanged.")
    page = PAGE.read_text(encoding="utf-8")
    new, n = re.subn(
        r"(<!-- POSTS:START -->\n).*?(\n\s*<!-- POSTS:END -->)",
        lambda m: m.group(1) + render(posts) + m.group(2),
        page,
        flags=re.S,
    )
    if n != 1:
        sys.exit("POSTS markers not found in index.html.")
    if new != page:
        PAGE.write_text(new, encoding="utf-8")
        print(f"Updated {len(posts)} posts.")
    else:
        print("No change.")


if __name__ == "__main__":
    main()
