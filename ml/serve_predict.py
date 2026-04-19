"""
Minimal HTTP API for production predictions (deploy on Railway, Render, Fly.io, etc.).

  pip install -r requirements.txt
  python ml/serve_predict.py

Vercel: set PREDICTION_API_URL to this service root URL (POST / with same JSON as /api/trending-predict).
Optional: PREDICT_API_TOKEN — if set, require header Authorization: Bearer <token>
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from flask import Flask, Response, request

_ML = Path(__file__).resolve().parent
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from stage_1_xg_boost import predict_trending_pipeline  # noqa: E402

app = Flask(__name__)
_EXPECTED_TOKEN = os.environ.get("PREDICT_API_TOKEN", "").strip()


@app.get("/health")
def health() -> Response:
    return Response("ok", mimetype="text/plain")


@app.post("/")
def predict() -> Response:
    if _EXPECTED_TOKEN:
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {_EXPECTED_TOKEN}":
            return _json_response({"error": "Unauthorized"}, 401)

    try:
        payload = request.get_json(force=True, silent=False)
    except Exception as e:
        return _json_response({"error": f"Invalid JSON: {e}"}, 400)

    if not isinstance(payload, dict):
        return _json_response({"error": "Body must be a JSON object"}, 400)

    try:
        out = predict_trending_pipeline(payload)
        return _json_response(out, 200)
    except Exception as e:
        return _json_response({"error": str(e)}, 502)


def _json_response(obj: dict, status: int) -> Response:
    return Response(
        json.dumps(obj),
        mimetype="application/json",
        status=status,
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port, threaded=True)
