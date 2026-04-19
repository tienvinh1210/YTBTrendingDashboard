"""
Build portfolio_training_insights.json from stage1_training_data.csv + channels_cache.

Run from Data_hack or YTBTrendingDashboard:
  python YTBTrendingDashboard/scripts/compute_portfolio_training_insights.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

CATEGORY_NAMES: dict[int, str] = {
    1: "Film & Animation",
    2: "Autos & Vehicles",
    10: "Music",
    15: "Pets & Animals",
    17: "Sports",
    19: "Travel & Events",
    20: "Gaming",
    22: "People & Blogs",
    23: "Comedy",
    24: "Entertainment",
    25: "News & Politics",
    26: "Howto & Style",
    27: "Education",
    28: "Science & Technology",
    29: "Nonprofits & Activism",
}

_REPO = Path(__file__).resolve().parents[1]
_DATA_HACK = _REPO.parent


def _default_paths() -> tuple[Path, Path, Path]:
    csv_candidates = [
        _REPO / "ml" / "data" / "stage1_training_data.csv",
        _DATA_HACK / "stage1_training_data.csv",
    ]
    csv_path = next((p for p in csv_candidates if p.is_file()), csv_candidates[0])
    cache_candidates = [
        _DATA_HACK / "data_enriched" / "channels_cache.json",
        _REPO / "data_enriched" / "channels_cache.json",
    ]
    cache_path = next((p for p in cache_candidates if p.is_file()), cache_candidates[0])
    out = _REPO / "ml" / "data" / "portfolio_training_insights.json"
    return csv_path, cache_path, out


def _country_map(cache_path: Path, channel_ids: set[str]) -> dict[str, str | None]:
    with cache_path.open(encoding="utf-8") as f:
        raw = json.load(f)
    out: dict[str, str | None] = {}
    for cid in channel_ids:
        payload = raw.get(cid)
        if not payload:
            out[cid] = None
            continue
        snippet = payload.get("snippet") or {}
        c = snippet.get("country")
        out[cid] = str(c).upper() if c else None
    return out


def _normalize_title_text(s: str) -> str:
    s = s.lower()
    s = re.sub(r"https?://\S+", " ", s)
    s = re.sub(r"[^\w\s#]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _similar_channel_pairs(
    ch_df: pd.DataFrame, category_id: int, max_pairs: int = 8
) -> list[dict]:
    """Within one category, channels with similar title TF-IDF (YouTube 'related' style)."""
    sub = ch_df[ch_df["category_id"] == category_id]
    if len(sub) < 2:
        return []
    vc = sub.groupby("channel_id").size()
    eligible = vc[vc >= 2].index
    sub = sub[sub["channel_id"].isin(eligible)]
    if len(sub) < 2:
        return []
    agg = (
        sub.groupby("channel_id")
        .agg(
            blob=("title_norm", lambda x: " ".join(x)),
            channel_title=("channel_title", "first"),
            country=("country", "first"),
            n_videos=("video_id", "count"),
        )
        .reset_index()
    )
    if len(agg) < 2:
        return []
    vec = TfidfVectorizer(max_features=4000, min_df=2, ngram_range=(1, 2))
    X = vec.fit_transform(agg["blob"])
    sim = cosine_similarity(X)
    np.fill_diagonal(sim, 0.0)
    pairs: list[tuple[float, str, str]] = []
    ids = agg["channel_id"].tolist()
    for i in range(len(ids)):
        j = int(sim[i].argmax())
        pairs.append((float(sim[i, j]), ids[i], ids[j]))
    pairs.sort(key=lambda t: t[0], reverse=True)
    seen: set[frozenset[str]] = set()
    out: list[dict] = []
    title_by_ch = agg.set_index("channel_id")["channel_title"].to_dict()
    country_by_ch = agg.set_index("channel_id")["country"].to_dict()
    nv_by_ch = agg.set_index("channel_id")["n_videos"].to_dict()
    for score, a, b in pairs:
        if score <= 0.01:
            break
        key = frozenset((a, b))
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "similarity": round(score, 4),
                "channelA": title_by_ch.get(a, a),
                "channelB": title_by_ch.get(b, b),
                "channelIdA": a,
                "channelIdB": b,
                "countryA": country_by_ch.get(a),
                "countryB": country_by_ch.get(b),
                "videosA": int(nv_by_ch.get(a, 0)),
                "videosB": int(nv_by_ch.get(b, 0)),
            }
        )
        if len(out) >= max_pairs:
            break
    return out


def main() -> None:
    csv_path, cache_path, out_path = _default_paths()
    if not csv_path.is_file():
        raise SystemExit(f"Missing training CSV: {csv_path}")
    if not cache_path.is_file():
        raise SystemExit(f"Missing channels cache: {cache_path}")

    usecols = [
        "video_id",
        "title",
        "channel_id",
        "channel_title",
        "category_id",
        "views",
        "trendy",
    ]
    df = pd.read_csv(csv_path, usecols=lambda c: c in usecols)
    df = df.dropna(subset=["channel_id", "category_id", "title"])
    df["category_id"] = df["category_id"].astype(int)

    trendy = df[df["trendy"] == 1].copy()
    ch_ids = set(trendy["channel_id"].astype(str).unique())
    print(f"Trending rows: {len(trendy)}, unique channels: {len(ch_ids)}")
    cmap = _country_map(cache_path, ch_ids)
    trendy["country"] = trendy["channel_id"].astype(str).map(cmap)

    trendy["category_name"] = trendy["category_id"].map(
        lambda x: CATEGORY_NAMES.get(int(x), f"Category {x}")
    )

    # --- Global category mix (trending rows) ---
    cat_counts = trendy["category_id"].value_counts()
    total = int(cat_counts.sum())
    global_mix = [
        {
            "categoryId": int(cid),
            "categoryName": CATEGORY_NAMES.get(int(cid), f"Category {cid}"),
            "count": int(cat_counts[cid]),
            "share": round(float(cat_counts[cid] / total), 4),
        }
        for cid in cat_counts.index
    ]

    # --- Per-country top categories (where country known) ---
    known = trendy[trendy["country"].notna()].copy()
    by_country: list[dict] = []
    for country, g in known.groupby("country"):
        vc = g["category_id"].value_counts()
        t = int(vc.sum())
        top = [
            {
                "categoryId": int(cid),
                "categoryName": CATEGORY_NAMES.get(int(cid), f"Category {cid}"),
                "count": int(vc[cid]),
                "share": round(float(vc[cid] / t), 4),
            }
            for cid in vc.head(8).index
        ]
        by_country.append({"country": country, "trendingVideos": t, "topCategories": top})

    by_country.sort(key=lambda x: x["trendingVideos"], reverse=True)

    # --- "Trending across countries": how often each category is in a country's top-3 ---
    top3_sets: dict[int, int] = {}
    for block in by_country:
        for row in block["topCategories"][:3]:
            cid = row["categoryId"]
            top3_sets[cid] = top3_sets.get(cid, 0) + 1
    cross_rank = sorted(
        [
            {
                "categoryId": cid,
                "categoryName": CATEGORY_NAMES.get(cid, f"Category {cid}"),
                "countriesWithTop3Presence": n,
            }
            for cid, n in top3_sets.items()
        ],
        key=lambda x: x["countriesWithTop3Presence"],
        reverse=True,
    )

    trendy["title_norm"] = trendy["title"].astype(str).map(_normalize_title_text)
    ch_df = trendy[["channel_id", "channel_title", "category_id", "title_norm", "country", "video_id"]]

    top_cat_ids = [int(x["categoryId"]) for x in global_mix[:6]]
    similar_by_category: list[dict] = []
    for cid in top_cat_ids:
        pairs = _similar_channel_pairs(ch_df, cid, max_pairs=6)
        if pairs:
            similar_by_category.append(
                {
                    "categoryId": cid,
                    "categoryName": CATEGORY_NAMES.get(cid, f"Category {cid}"),
                    "pairs": pairs,
                }
            )

    payload = {
        "sourceCsv": str(csv_path).replace("\\", "/"),
        "sourceCache": str(cache_path).replace("\\", "/"),
        "trendyRowCount": len(trendy),
        "channelsWithCountry": int(known["channel_id"].nunique()),
        "summary": (
            "Trending rows are stage1 training samples with trendy=1. "
            "Channel country comes from channels_cache snippet.country. "
            "Similar channels use TF-IDF cosine similarity on normalized titles within the same category."
        ),
        "globalCategoryMix": global_mix[:15],
        "categoryTrendingAcrossCountries": cross_rank[:12],
        "topCategoriesByCountry": by_country,
        "similarChannelsByCategory": similar_by_category,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
