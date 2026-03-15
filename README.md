# PiAxis —  Ranking Service

A Node.js + TypeScript service that searches and ranks architectural construction details using **fuzzy text matching** (Levenshtein distance) and **contextual filtering** (host element, adjacent element, exposure).

## Table of Contents

- [Features](#features)
- [Setup Instructions](#setup-instructions)
- [How to Run](#how-to-run)
- [API Reference](#api-reference)
- [Test Cases](#test-cases)
- [Scoring Algorithm](#scoring-algorithm)

---

## Features

- **Fuzzy Search** — Tolerates typos up to 2 edits using Levenshtein distance (e.g. `wndow` matches `window`)
- **Exact Search** — Wrap terms in quotes (`"slab"`) to enforce exact matching only
- **Context Filtering** — Filter by `host_element`, `adjacent_element`, and `exposure`
- **Auto-Correction Banner** — Shows "Searched for: window" when the user types `wndow`, similar to Google
- **Weighted Scoring** — Title matches score highest (×1.5), then tags (×1.2), then description (×1.0)
- **Simple Web UI** — Built-in HTML interface served from `/`

## Setup Instructions

### Prerequisites

- **Node.js** v16 or higher
- **npm** v8 or higher

### Install Dependencies

```bash
cd ranking-service
npm install
```

## How to Run

### Development (runs TypeScript directly)

```bash
npm start
```

The server starts at **http://localhost:3000**.

- Web UI: http://localhost:3000

## API Reference

### `POST /search`

Search and rank architectural details.

**Request Body** (JSON) — all fields optional, but at least one must be provided:

| Field              | Type   | Description                           |
|--------------------|--------|---------------------------------------|
| `query`            | string | Free-text search (supports fuzzy and quoted exact) |
| `host_element`     | string | Filter by host element (e.g. `External Wall`, `Window`) |
| `adjacent_element` | string | Filter by adjacent element (e.g. `Slab`, `Floor`) |
| `exposure`         | string | Filter by exposure (e.g. `External`, `Internal`) |


Open http://localhost:3000 in a browser. Enter a search query and/or select context filters, then click **Search**.

---

## Test Cases

### Text Search

| # | Category | Query | Matches | Top Detail | Banner | Why |
|---|----------|-------|---------|------------|--------|-----|
| 1 | Single word exact | `window` | `window` (dist 0) | Detail 2 | No | Exact match in title and tags |
| 2 | Multi word exact | `wall slab` | `wall`, `slab` (both dist 0) | Detail 1 | No | Both words match exactly |
| 3 | Minor typo (1 edit) | `wndow` | `window` (dist 1) | Detail 2 | "Searched for: window" | Missing letter `i`, still scores 2 |
| 4 | Multi word typos | `wndow drp` | `window`, `drip` (both dist 1) | Detail 2 | "Searched for: window drip" | Both words corrected |
| 5 | Moderate typo (2 edits) | `wdow` | `window` (dist 2) | Detail 2 | "Searched for: window" | 2 edits away, scores 1 (boundary) |
| 6 | No match | `plumbing` | None (dist 3+) | All score 0 | No | Too far from any vocabulary word |


### Anti-Fuzzy (Exact) Search

| # | Category | Query | Matches | Top Detail | Banner | Why |
|---|----------|-------|---------|------------|--------|-----|
| 8 | Exact — word exists | `"slab"` | `slab` (dist 0 only) | Detail 1 | No | Quoted, exact match in tags |
| 9 | Exact — word missing | `"slob"` | None | All score 0 | No | `slob` not in data; without quotes it would match `slab` |
| 10 | Exact — typo ignored | `"wndow"` | None | All score 0 | No | `wndow` doesn't exist exactly; fuzzy disabled by quotes |


### Context Search

| # | Category | Filters | Top Detail | Score Breakdown | Why |
|---|----------|---------|------------|-----------------|-----|
| 12 | Single context field | host=`External Wall` | Detail 1 | host +3 = 6.0 | Context-only, score doubled |
| 13 | Multiple context fields | host=`External Wall`, exposure=`External` | Detail 1 | host +3, exposure +1 = 8.0 | Both fields match |
| 14 | All context fields | host=`Window`, adjacent=`External Wall`, exposure=`External` | Detail 2 | host +3, adjacent +2, exposure +1 = 12.0 | Full context match |


### Combined (Text + Context)

| # | Category | Query | Filters | Top Detail | Banner | Why |
|---|----------|-------|---------|------------|--------|-----|
| 16 | Exact text + context | `waterproofing` | host=`External Wall`, adjacent=`Slab` | Detail 1 | No | High text score + full context match |
| 17 | Typo text + context | `wndow` | host=`Window` | Detail 2 | "Searched for: window" | Fuzzy text match + context boost |
| 18 | Anti-fuzzy + context | `"drip"` | exposure=`External` | Detail 2 | No | Exact match on drip + exposure match |
| 19 | No text match + context | `plumbing` | host=`External Wall` | Detail 1 | No | Text scores 0, context alone ranks |

---

## Scoring Algorithm

### Text Score (per token, per detail)

Each query token is compared against the detail's **title**, **tags**, and **description** using Levenshtein distance:

| Distance | Score | Meaning       |
|----------|-------|---------------|
| 0        | 3     | Exact match   |
| 1        | 2     | Minor typo    |
| 2        | 1     | Moderate typo |
| 3+       | 0     | No match      |

Field weights: **title ×1.5**, **tags ×1.2**, **description ×1.0**. Only the highest-scoring field per token is kept (no double counting).

### Context Score (per detail)

| Field matched      | Score |
|--------------------|-------|
| `host_element`     | +3    |
| `adjacent_element` | +2    |
| `exposure`         | +1    |

### Final Score

- **With text query:** `final = (textScore × 2.0) + (contextScore × 1.0)`
- **Without text query:** `final = contextScore × 2.0`

Results are sorted by final score (descending) and the top 5 are returned.

---

## Engineering Questions

### 1. If this system needed to support 100,000+ details, what changes would you make?

- Move data to **Elasticsearch**. It uses an **inverted index** — instead of scanning every record, it looks up which records contain the query token. Like a book index vs reading every page.
- Built-in **fuzzy matching**, no need to write Levenshtein manually. Scales **horizontally** — add more nodes as data grows.
- **Pre-compute tokenized fields** at insert time.

### 2. What improvements would you make to the search or ranking logic in a production system?

- Replace manual field weights (×1.5, ×1.2, ×1.0) with **TF-IDF or BM25** scoring. TF-IDF automatically gives rare, specific words like `waterproofing` a higher weight than common words like `detail` or `with` — no hardcoding needed. BM25 extends this with document length normalization so long descriptions don't unfairly outscore short ones.
- Add a **synonym dictionary** so semantically equivalent terms map to each other at query time — e.g. `wall` → `partition`, `waterproofing` → `moisture barrier`, `sill` → `threshold`. Queries match more details without changing the underlying data.
- Add **stemming** so `waterproofing`, `waterproof`, and `waterproofed` all reduce to the same root and match each other — currently they score as different words due to edit distance.

### 3. What additional data or signals could help improve recommendation quality?

- Right now recommendations are based only on text + 3 context fields. That's a very narrow signal.
- **Usage frequency / popularity** — if Detail 2 is searched and selected 10,000 times vs Detail 1 selected 50 times, popularity is a strong signal that a result is genuinely useful. Boost the score of frequently-used details slightly.
- **Co-occurrence data** — if users who search `window sill` also frequently view `drip groove detail`, these two are related and the second should be surfaced proactively. This is how "users also viewed" works on e-commerce sites.

### 4. If this API became a shared service used by multiple applications, what changes would you make to its architecture?

- Add an **API Gateway**  as a single entry point for all consumers — handles auth, rate limiting, and logging in one place. Each application gets its own API key.
- Add a **Load Balancer** — run multiple Node.js instances behind Nginx to distribute traffic so no single process is overwhelmed.
- Apply **rate limiting per consumer** — App A gets 1,000 req/min, App B gets 500 req/min. Prevents one bad consumer from degrading the service for others.

### 5. What would you change if this system needed to support AI-based recommendations?

- Use **vector embeddings for semantic search** — convert each detail's title + description into a vector , convert the query into a vector too, and find details whose vectors are closest. `"prevent water getting in"` becomes close to `"waterproofing membrane"` in vector space even with zero word overlap. Tools: OpenAI embeddings, or pgvector in Postgres.
- Use a **hybrid scoring** approach: `final = (a × fuzzyScore) + (b × contextScore) + (c × semanticSimilarity)` — combine the existing fuzzy + context system with semantic search so neither replaces the other.
