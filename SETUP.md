# YTBTrendingDashboard — setup (this folder is the git repo)

## 1. Clone

```bash
git clone <url> YTBTrendingDashboard
cd YTBTrendingDashboard
```

## 2. Python (training + `scripts/run_predict_pipeline.py`)

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
```

Put training CSVs in **`ml/data/`** (or keep them next to this repo in a parent folder — the scripts also look for `../stage1_training_data.csv`):

- `ml/data/stage1_training_data.csv`
- `ml/data/stage2_training_data.csv`

Or set environment variables:

- `STAGE1_TRAINING_CSV` — full path to stage 1 CSV
- `STAGE2_TRAINING_CSV` — full path to stage 2 CSV

Train models (writes JSON under **`models/`**):

```bash
python ml/stage_1_xg_boost.py
python ml/stage_2.py
```

## 3. Next.js

```bash
npm install
```

Create **`.env`**:

```env
API_KEY=<YouTube Data API v3 key>
```

Optional:

- `PYTHON_PATH` — Python executable for predictions
- `DASHBOARD_ROOT` — absolute path to this repo if Next’s `cwd` is not this folder

```bash
npm run dev
```

## 4. Predictions

Video Overview calls **`POST /api/trending-predict`**, which runs **`scripts/run_predict_pipeline.py`** with `cwd` = `scripts/`. That script adds **`ml/`** to `PYTHONPATH` and imports the stage modules.
