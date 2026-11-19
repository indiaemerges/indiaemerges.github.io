# indiaemerges.com

Front page for indiaemerges, served by GitHub Pages at https://indiaemerges.com.

- `index.html` – front page: dashboards, latest writing, about.
- `state-finances/` – the India State Finances Explorer (RBI e-STATES), at /state-finances/.
- `tools/update_posts.py` – refreshes the "Writing" list from the Substack feed.
- `.github/workflows/update-posts.yml` – runs that script daily and commits any change.
- `CNAME` – tells GitHub Pages to serve this site at indiaemerges.com.

The existing dashboards stay in the `india-data-dashboard` repo and appear at
https://indiaemerges.com/india-data-dashboard/ once this site has the custom domain.
