# CulinaryMatrix
meal creator
# 🚀 Ship and Scrape: CulinaryBrief Matrix v2

Congrats! Your repo is ready for production scraping and data generation.

---

## 1. Push to GitHub

1. **Create a new GitHub repository** (or use your existing one).
2. **Copy and commit** all files from your "repo bundle" (as outlined above).
   - Include `.devcontainer/`, `scripts/scrape/`, `data/`, etc.

---

## 2. Open in Codespaces

1. On your new repo page, click **"Code" → "Create codespace on main"** (or your primary branch).
2. Wait for the Codespace to finish setup (devcontainer will install Node, pnpm, etc.).

---

## 3. (Optional) Add Recipe Corpus for Pair Mining

- Place your `.jsonl`, `.json`, or `.csv` recipe dataset in `data/raw/`.
- Set `PAIR_MINE_SOURCE=./data/raw/your-corpus.jsonl` in your `.env` file.

---

## 4. Run the Scraper

In your Codespace terminal, run:

```bash


```

- This will fetch Wikipedia/Wikidata for source ingredients and techniques.
- If a recipe corpus is provided, it will mine pairings and scores.
- Outputs will be generated under `data/`:
  - `data/matrix.v2.json`
  - `data/stage/ingredients.csv`
  - `data/stage/pairings.csv`
  - `data/stage/techniques.csv`
  - `data/stage/edges.csv`

---

## 5. QA Your Results

- Inspect the outputs in `data/` using VS Code in Codespaces.
- Optionally, use your app’s validator to check referential integrity.

---

## 6. (Optional) CI/CD or Docker

- Use `docker build` and `docker run` or GitHub Actions as described in the repo for automated builds.

---

## 7. Ship!

- Download or use `matrix.v2.json` in your app.
- Use the CSVs for admin import or further QA.

---

**You are fully shipped and scraped. 🚀**

If you need to expand sources or tweak the pipeline, just edit `sources.json` or your `.env` and re-run.