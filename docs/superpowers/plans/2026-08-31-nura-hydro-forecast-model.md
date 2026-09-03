# Nura Basin Hydrological Forecast Model — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a baseline short-term (3-day-ahead) water-level forecast model for hydropost 13076 (р. Нура, с. Р. Кошкарбаева) trained on 1995-2023 daily level/discharge/meteo data, and expose it in the AI Gidromap Next.js app as a new chat tool and API endpoint.

**Architecture:** Data extraction and model training happen offline in Python (pandas/scikit-learn — the mature ecosystem for this kind of tabular regression work); the trained model is exported to ONNX and loaded for inference inside the existing Node.js app via `onnxruntime-node`, exposed through a new `/api/forecast` route and a new `get_hydro_forecast` chat tool. This mirrors the project's established "compute once offline, serve a static/lightweight artifact at runtime" pattern already used for the GRWL river-width data and terrain tiles (see `CLAUDE.md`).

**Tech Stack:** Python 3 + pandas + scikit-learn + skl2onnx (training, offline, not part of the deployed app); TypeScript + `onnxruntime-node` (inference, inside the Next.js app).

## Global Constraints

- This plan covers **post 13076 only**, as a proof of concept. Scaling to the other 18 posts in the Nura basin batch is explicitly out of scope for this plan — see "Follow-on phases" at the end.
- **Long-term (seasonal) forecasting is out of scope for this plan** — it needs a different feature set (winter snow accumulation proxies aggregated over months, not daily lag features) and is a separate model; see "Follow-on phases."
- Level values in `data/hydro-forecast-source/гидро/13076 H.xlsx` are already in centimeters — do **not** multiply by 100 (this was verified against the app's existing 1974-2022 history for this post across 25 overlapping years; see `docs/superpowers/plans` session notes — highest-year values matched within 1-2%).
- Chronological train/test split is mandatory for all time-series validation in this plan — never shuffle randomly across years, since that leaks future information into training and would make validation metrics meaningless for a forecasting use case.
- Ice-covered readings (see ICE_CHARS list in Task 1) are physically valid data and must stay in the training set — they are only excluded from the app's separate "open-water high" summary statistic, not from a forecast model, which needs the full year including winter behavior.

---

## File Structure

- Create: `scripts/hydro_forecast/requirements.txt` — Python dependencies
- Create: `scripts/hydro_forecast/extract_data.py` — parses raw Excel/CSV into one clean daily CSV
- Create: `scripts/hydro_forecast/train_model.py` — feature engineering + training + ONNX export
- Create: `scripts/hydro_forecast/validate_model.py` — computes held-out metrics, writes a report
- Create: `data/forecast/post_13076_daily.csv` — output of `extract_data.py` (checked into git — it's derived from source data that itself isn't in the runtime app, same treatment as other `data/` artifacts)
- Create: `data/forecast/post_13076_model.onnx` — trained model (binary, checked into git — it's small, a few hundred KB for a gradient-boosting model at this feature count)
- Create: `data/forecast/post_13076_model_meta.json` — feature order + scaling stats needed at inference time
- Create: `data/forecast/post_13076_validation_report.json` — output of `validate_model.py`
- Create: `src/lib/hydroForecast.ts` — loads the ONNX model, exposes `forecastLevel()`
- Create: `src/app/api/forecast/route.ts` — `GET /api/forecast?post_code=13076` HTTP endpoint
- Modify: `src/app/api/chat/route.ts` — add a `get_hydro_forecast` tool wired to the same `forecastLevel()` function

---

### Task 1: Data extraction script

**Files:**
- Create: `scripts/hydro_forecast/requirements.txt`
- Create: `scripts/hydro_forecast/extract_data.py`
- Test: `scripts/hydro_forecast/test_extract_data.py`

**Interfaces:**
- Produces: `data/forecast/post_13076_daily.csv` with columns `date,level_cm,discharge_m3s,ice_flag,precip_mm,temp_mean_c` (one row per calendar date, 1995-01-01 through 2023-12-31; missing values left as empty CSV fields, not `0` or interpolated — Task 2 handles missing data explicitly).
- Produces: a reusable `is_ice_flag(flag: str) -> bool` function and an `ICE_CHARS` constant other scripts/tests can import.

- [ ] **Step 1: Write the failing test**

Create `scripts/hydro_forecast/test_extract_data.py`:

```python
import pandas as pd
from extract_data import is_ice_flag, ICE_CHARS, build_dataset

def test_is_ice_flag_detects_ice_characters():
    assert is_ice_flag("I") is True
    assert is_ice_flag("_]I") is True
    assert is_ice_flag("Л") is True

def test_is_ice_flag_ignores_non_ice_notes():
    assert is_ice_flag("Т") is False  # grass note, not ice
    assert is_ice_flag("В") is False  # standing water, not ice
    assert is_ice_flag(None) is False
    assert is_ice_flag("") is False

def test_build_dataset_produces_expected_columns():
    df = build_dataset(
        h_path="../../data/hydro-forecast-source/гидро/13076 H.xlsx",
        q_path="../../data/hydro-forecast-source/гидро/13076 Q.xlsx",
        meteo_path="../../data/hydro-forecast-source/метео/35382_5027160.csv",
        post_code=13076,
    )
    assert list(df.columns) == ["date", "level_cm", "discharge_m3s", "ice_flag", "precip_mm", "temp_mean_c"]
    assert df["date"].is_monotonic_increasing
    assert df["date"].iloc[0] == pd.Timestamp("1995-01-01")
    assert df["date"].iloc[-1] == pd.Timestamp("2023-12-31")
    # spot-check a known day used during earlier manual verification
    row = df[df["date"] == "2015-04-18"].iloc[0]
    assert 880 <= row["level_cm"] <= 884
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/hydro_forecast && pip install -r requirements.txt && pytest test_extract_data.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'extract_data'` (file doesn't exist yet)

- [ ] **Step 3: Write `requirements.txt`**

```
pandas>=2.0
openpyxl>=3.1
scikit-learn>=1.4
skl2onnx>=1.16
onnxruntime>=1.17
```

- [ ] **Step 4: Write minimal implementation**

Create `scripts/hydro_forecast/extract_data.py`:

```python
"""Builds a single clean daily CSV for one hydropost from raw Kazgidromet
H (level), Q (discharge), and meteo station export files.

Level values in the H files are already in centimeters (verified against
the app's existing 1974-2022 history for post 13076 across 25 overlapping
years — do not multiply by 100 here).
"""
import sys
import pandas as pd

ICE_CHARS = set(":);*ШИСХЛ+КГ><БЪ@Ч]ФZI&ЕНQF=~(WПРN#")


def is_ice_flag(flag) -> bool:
    if not flag:
        return False
    return any(ch in ICE_CHARS for ch in str(flag))


def _load_level(h_path: str, post_code: int) -> pd.DataFrame:
    df = pd.read_excel(h_path, header=1)
    df = df[df["Код поста"] == post_code].copy()
    df["date"] = pd.to_datetime(df["Дата"], unit="D", origin="1899-12-30")
    df["level_cm"] = pd.to_numeric(df["Значение"], errors="coerce")
    df["ice_flag"] = df["Условный знак"].apply(is_ice_flag)
    return df[["date", "level_cm", "ice_flag"]]


def _load_discharge(q_path: str, post_code: int) -> pd.DataFrame:
    df = pd.read_excel(q_path, header=1)
    df = df[df["Код поста"] == post_code].copy()
    df["date"] = pd.to_datetime(df["Дата"], unit="D", origin="1899-12-30")
    df["discharge_m3s"] = pd.to_numeric(df["Значение"], errors="coerce")
    return df[["date", "discharge_m3s"]]


def _load_meteo(meteo_path: str) -> pd.DataFrame:
    df = pd.read_csv(meteo_path, sep=";", encoding="utf-8-sig")
    df["date"] = pd.to_datetime(df["date_obs"]).dt.normalize()
    df["precip_mm"] = pd.to_numeric(df["precip"], errors="coerce")
    df["temp_mean_c"] = pd.to_numeric(df["tmpmn"], errors="coerce")
    return df[["date", "precip_mm", "temp_mean_c"]]


def build_dataset(h_path: str, q_path: str, meteo_path: str, post_code: int) -> pd.DataFrame:
    level = _load_level(h_path, post_code)
    discharge = _load_discharge(q_path, post_code)
    meteo = _load_meteo(meteo_path)

    full_range = pd.DataFrame({"date": pd.date_range("1995-01-01", "2023-12-31", freq="D")})
    merged = (
        full_range
        .merge(level, on="date", how="left")
        .merge(discharge, on="date", how="left")
        .merge(meteo, on="date", how="left")
    )
    merged["ice_flag"] = merged["ice_flag"].fillna(False)
    return merged[["date", "level_cm", "discharge_m3s", "ice_flag", "precip_mm", "temp_mean_c"]]


if __name__ == "__main__":
    df = build_dataset(
        h_path="../../data/hydro-forecast-source/гидро/13076 H.xlsx",
        q_path="../../data/hydro-forecast-source/гидро/13076 Q.xlsx",
        meteo_path="../../data/hydro-forecast-source/метео/35382_5027160.csv",
        post_code=13076,
    )
    out_path = "../../data/forecast/post_13076_daily.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
    print(f"Missing level_cm: {df['level_cm'].isna().sum()} days")
    print(f"Missing discharge_m3s: {df['discharge_m3s'].isna().sum()} days")
    print(f"Missing precip_mm: {df['precip_mm'].isna().sum()} days")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest test_extract_data.py -v`
Expected: PASS (4 tests)

- [ ] **Step 6: Generate the actual dataset file**

Run: `python extract_data.py`
Expected output ends with three "Missing ..." lines — read the counts. If `Missing level_cm` is anywhere near the full 10585-day range, something is wrong with the `Код поста` filter or the file path — stop and re-check before continuing, don't proceed to Task 2 on an empty dataset.

- [ ] **Step 7: Commit**

```bash
mkdir -p data/forecast
git add scripts/hydro_forecast/requirements.txt scripts/hydro_forecast/extract_data.py scripts/hydro_forecast/test_extract_data.py data/forecast/post_13076_daily.csv
git commit -m "Add data extraction script for post 13076 hydro forecast model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Feature engineering and model training

**Files:**
- Create: `scripts/hydro_forecast/train_model.py`
- Test: `scripts/hydro_forecast/test_train_model.py`

**Interfaces:**
- Consumes: `data/forecast/post_13076_daily.csv` (from Task 1), columns `date,level_cm,discharge_m3s,ice_flag,precip_mm,temp_mean_c`.
- Produces: `build_features(df: pd.DataFrame, horizon_days: int) -> tuple[pd.DataFrame, pd.Series]` returning `(X, y)` where `y` is `level_cm` shifted `horizon_days` into the future.
- Produces: `data/forecast/post_13076_model.onnx` and `data/forecast/post_13076_model_meta.json` with shape `{"feature_order": [...], "horizon_days": 3, "train_start": "1995-01-01", "train_end": "2020-12-31"}`.

- [ ] **Step 1: Write the failing test**

Create `scripts/hydro_forecast/test_train_model.py`:

```python
import pandas as pd
from train_model import build_features

def _sample_df():
    dates = pd.date_range("2020-01-01", periods=10, freq="D")
    return pd.DataFrame({
        "date": dates,
        "level_cm": [100, 102, 101, 105, 110, 108, 107, 106, 104, 103],
        "discharge_m3s": [5, 5, 5, 6, 7, 7, 6, 6, 5, 5],
        "ice_flag": [True]*10,
        "precip_mm": [0, 0, 1, 2, 0, 0, 0, 0, 0, 0],
        "temp_mean_c": [-10]*10,
    })

def test_build_features_shifts_target_by_horizon():
    X, y = build_features(_sample_df(), horizon_days=3)
    # first 3 rows lack full lag history (lag_3 undefined) and last 3 lack
    # a future target — both must be dropped, leaving 10 - 3 - 3 = 4 rows
    assert len(X) == 4
    assert len(y) == 4
    # y at the first valid row is level_cm 3 days after that row's date
    first_valid_date = X.iloc[0]["date"]
    expected_target_date = first_valid_date + pd.Timedelta(days=3)
    full = _sample_df().set_index("date")
    assert y.iloc[0] == full.loc[expected_target_date, "level_cm"]

def test_build_features_includes_expected_columns():
    X, _ = build_features(_sample_df(), horizon_days=3)
    for col in ["level_lag0", "level_lag1", "level_lag2", "level_lag3",
                "discharge_lag0", "precip_sum3", "temp_mean3",
                "doy_sin", "doy_cos"]:
        assert col in X.columns
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest test_train_model.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'train_model'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/hydro_forecast/train_model.py`:

```python
"""Trains a gradient-boosting regressor to predict water level N days ahead
for hydropost 13076, and exports it to ONNX for inference from Node.js.
"""
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from skl2onnx import to_onnx

FEATURE_ORDER = [
    "level_lag0", "level_lag1", "level_lag2", "level_lag3",
    "discharge_lag0", "precip_sum3", "temp_mean3", "doy_sin", "doy_cos",
]


def build_features(df: pd.DataFrame, horizon_days: int) -> tuple[pd.DataFrame, pd.Series]:
    df = df.sort_values("date").reset_index(drop=True)
    out = pd.DataFrame({"date": df["date"]})
    out["level_lag0"] = df["level_cm"]
    out["level_lag1"] = df["level_cm"].shift(1)
    out["level_lag2"] = df["level_cm"].shift(2)
    out["level_lag3"] = df["level_cm"].shift(3)
    out["discharge_lag0"] = df["discharge_m3s"]
    out["precip_sum3"] = df["precip_mm"].rolling(3, min_periods=1).sum()
    out["temp_mean3"] = df["temp_mean_c"].rolling(3, min_periods=1).mean()
    doy = df["date"].dt.dayofyear
    out["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    out["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)

    target = df["level_cm"].shift(-horizon_days)
    out["target"] = target

    out = out.dropna().reset_index(drop=True)
    y = out.pop("target")
    return out, y


def main():
    df = pd.read_csv("../../data/forecast/post_13076_daily.csv", parse_dates=["date"])
    horizon_days = 3
    X, y = build_features(df, horizon_days)

    train_end = pd.Timestamp("2020-12-31")
    train_mask = X["date"] <= train_end
    X_train, y_train = X.loc[train_mask, FEATURE_ORDER], y[train_mask]

    model = GradientBoostingRegressor(n_estimators=200, max_depth=3, random_state=0)
    model.fit(X_train, y_train)

    train_mae = mean_absolute_error(y_train, model.predict(X_train))
    print(f"Train MAE: {train_mae:.2f} cm ({len(X_train)} rows)")

    onnx_model = to_onnx(model, X_train.values.astype(np.float32))
    with open("../../data/forecast/post_13076_model.onnx", "wb") as f:
        f.write(onnx_model.SerializeToString())

    meta = {
        "feature_order": FEATURE_ORDER,
        "horizon_days": horizon_days,
        "train_start": str(X["date"].min().date()),
        "train_end": str(train_end.date()),
    }
    with open("../../data/forecast/post_13076_model_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("Wrote post_13076_model.onnx and post_13076_model_meta.json")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest test_train_model.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the training script**

Run: `python train_model.py`
Expected: prints a "Train MAE: N.NN cm (X rows)" line where X is roughly `(2020-1995)*365 - 6 ≈ 9494`, and writes the two output files.

- [ ] **Step 6: Commit**

```bash
git add scripts/hydro_forecast/train_model.py scripts/hydro_forecast/test_train_model.py data/forecast/post_13076_model.onnx data/forecast/post_13076_model_meta.json
git commit -m "Train baseline 3-day-ahead level forecast model for post 13076

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Validation against held-out 2021-2023 data

**Files:**
- Create: `scripts/hydro_forecast/validate_model.py`
- Test: `scripts/hydro_forecast/test_validate_model.py`

**Interfaces:**
- Consumes: `data/forecast/post_13076_daily.csv`, `data/forecast/post_13076_model.onnx`, `data/forecast/post_13076_model_meta.json` (all from Tasks 1-2), plus `build_features` from `train_model.py`.
- Produces: `nash_sutcliffe(y_true: np.ndarray, y_pred: np.ndarray) -> float`, a standard hydrology model-quality metric (1.0 = perfect, 0.0 = no better than predicting the mean, negative = worse than the mean).
- Produces: `data/forecast/post_13076_validation_report.json` with shape `{"mae_cm": ..., "rmse_cm": ..., "nse": ..., "n_days": ..., "period": "2021-01-01..2023-12-31"}`.

- [ ] **Step 1: Write the failing test**

Create `scripts/hydro_forecast/test_validate_model.py`:

```python
import numpy as np
from validate_model import nash_sutcliffe

def test_nash_sutcliffe_perfect_prediction_is_one():
    y = np.array([100.0, 105.0, 110.0, 108.0])
    assert nash_sutcliffe(y, y) == 1.0

def test_nash_sutcliffe_mean_prediction_is_zero():
    y = np.array([100.0, 105.0, 110.0, 108.0])
    mean_pred = np.full_like(y, y.mean())
    assert abs(nash_sutcliffe(y, mean_pred)) < 1e-9

def test_nash_sutcliffe_worse_than_mean_is_negative():
    y = np.array([100.0, 105.0, 110.0, 108.0])
    bad_pred = np.array([200.0, 5.0, 300.0, 1.0])
    assert nash_sutcliffe(y, bad_pred) < 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest test_validate_model.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'validate_model'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/hydro_forecast/validate_model.py`:

```python
"""Validates the trained model against the 2021-2023 held-out period
(data the model never saw during training) and writes a metrics report."""
import json
import numpy as np
import pandas as pd
import onnxruntime as ort
from train_model import build_features, FEATURE_ORDER


def nash_sutcliffe(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    numerator = np.sum((y_true - y_pred) ** 2)
    denominator = np.sum((y_true - y_true.mean()) ** 2)
    return 1 - numerator / denominator


def main():
    df = pd.read_csv("../../data/forecast/post_13076_daily.csv", parse_dates=["date"])
    with open("../../data/forecast/post_13076_model_meta.json", encoding="utf-8") as f:
        meta = json.load(f)

    X, y = build_features(df, meta["horizon_days"])
    test_mask = X["date"] > pd.Timestamp(meta["train_end"])
    X_test, y_test = X.loc[test_mask, FEATURE_ORDER], y[test_mask].to_numpy()

    session = ort.InferenceSession("../../data/forecast/post_13076_model.onnx")
    input_name = session.get_inputs()[0].name
    y_pred = session.run(None, {input_name: X_test.values.astype(np.float32)})[0].flatten()

    mae = float(np.mean(np.abs(y_test - y_pred)))
    rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))
    nse = float(nash_sutcliffe(y_test, y_pred))

    report = {
        "mae_cm": round(mae, 2),
        "rmse_cm": round(rmse, 2),
        "nse": round(nse, 3),
        "n_days": len(y_test),
        "period": f"{X.loc[test_mask, 'date'].min().date()}..{X.loc[test_mask, 'date'].max().date()}",
    }
    with open("../../data/forecast/post_13076_validation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    print(
        "NSE guide: >0.75 very good, 0.5-0.75 good, 0.2-0.5 satisfactory, "
        "<0.2 unsatisfactory (standard hydrology thresholds, Moriasi et al. 2007)"
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest test_validate_model.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run validation and read the result**

Run: `python validate_model.py`
Expected: prints the JSON report and the NSE guide line. **Read the NSE value** — if it's below 0.2, the baseline model isn't usable as-is and Task 4-6 (app integration) should be paused pending a discussion of why (more features? different horizon? post 13076 might just be harder to predict without upstream data) rather than shipping a forecast nobody should trust.

- [ ] **Step 6: Commit**

```bash
git add scripts/hydro_forecast/validate_model.py scripts/hydro_forecast/test_validate_model.py data/forecast/post_13076_validation_report.json
git commit -m "Validate 3-day forecast model against 2021-2023 held-out period

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Node.js inference module

**Files:**
- Create: `src/lib/hydroForecast.ts`
- Modify: `package.json` (add `onnxruntime-node` dependency)

**Interfaces:**
- Consumes: `data/forecast/post_13076_model.onnx`, `data/forecast/post_13076_model_meta.json` (from Tasks 2-3), `data/forecast/post_13076_daily.csv` (from Task 1, to pull the most recent real observations at request time).
- Produces: `forecastLevel(postCode: number): Promise<{ forecastCm: number; horizonDays: number; asOfDate: string } | null>` — returns `null` if `postCode` has no model available yet (only 13076 in this plan).

- [ ] **Step 1: Install the dependency**

Run: `npm install onnxruntime-node`

- [ ] **Step 2: Write the implementation**

Create `src/lib/hydroForecast.ts`:

```typescript
import { InferenceSession, Tensor } from "onnxruntime-node";
import fs from "fs";
import path from "path";

type ModelMeta = {
  feature_order: string[];
  horizon_days: number;
  train_start: string;
  train_end: string;
};

type DailyRow = {
  date: string;
  level_cm: string;
  discharge_m3s: string;
  ice_flag: string;
  precip_mm: string;
  temp_mean_c: string;
};

const MODEL_POSTS: Record<number, string> = {
  13076: "post_13076",
};

const sessionCache = new Map<number, InferenceSession>();

function parseCsv(filePath: string): DailyRow[] {
  const text = fs.readFileSync(filePath, "utf-8");
  const [header, ...lines] = text.trim().split("\n");
  const cols = header.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row = {} as DailyRow;
    cols.forEach((col, i) => { (row as Record<string, string>)[col] = values[i] ?? ""; });
    return row;
  });
}

function buildFeatureRow(rows: DailyRow[], targetIndex: number, featureOrder: string[]): Float32Array {
  const num = (i: number, key: keyof DailyRow) => {
    const v = rows[i]?.[key];
    return v === undefined || v === "" ? NaN : Number(v);
  };
  const precipSum3 = [0, 1, 2].reduce((sum, back) => sum + (num(targetIndex - back, "precip_mm") || 0), 0);
  const tempVals = [0, 1, 2].map((back) => num(targetIndex - back, "temp_mean_c")).filter((v) => !Number.isNaN(v));
  const tempMean3 = tempVals.length > 0 ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length : 0;
  const date = new Date(rows[targetIndex].date);
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const doy = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);

  const featureMap: Record<string, number> = {
    level_lag0: num(targetIndex, "level_cm"),
    level_lag1: num(targetIndex - 1, "level_cm"),
    level_lag2: num(targetIndex - 2, "level_cm"),
    level_lag3: num(targetIndex - 3, "level_cm"),
    discharge_lag0: num(targetIndex, "discharge_m3s"),
    precip_sum3: precipSum3,
    temp_mean3: tempMean3,
    doy_sin: Math.sin((2 * Math.PI * doy) / 365.25),
    doy_cos: Math.cos((2 * Math.PI * doy) / 365.25),
  };

  return Float32Array.from(featureOrder.map((f) => featureMap[f]));
}

export async function forecastLevel(
  postCode: number,
): Promise<{ forecastCm: number; horizonDays: number; asOfDate: string } | null> {
  const slug = MODEL_POSTS[postCode];
  if (!slug) return null;

  const dataDir = path.join(process.cwd(), "data", "forecast");
  const meta: ModelMeta = JSON.parse(fs.readFileSync(path.join(dataDir, `${slug}_model_meta.json`), "utf-8"));
  const rows = parseCsv(path.join(dataDir, `${slug}_daily.csv`));

  let lastCompleteIndex = -1;
  for (let i = rows.length - 1; i >= 3; i--) {
    if (rows[i].level_cm !== "" && rows[i - 1].level_cm !== "" && rows[i - 2].level_cm !== "" && rows[i - 3].level_cm !== "") {
      lastCompleteIndex = i;
      break;
    }
  }
  if (lastCompleteIndex === -1) return null;

  const features = buildFeatureRow(rows, lastCompleteIndex, meta.feature_order);

  let session = sessionCache.get(postCode);
  if (!session) {
    session = await InferenceSession.create(path.join(dataDir, `${slug}_model.onnx`));
    sessionCache.set(postCode, session);
  }

  const inputName = session.inputNames[0];
  const tensor = new Tensor("float32", features, [1, features.length]);
  const output = await session.run({ [inputName]: tensor });
  const forecastCm = Number(output[session.outputNames[0]].data[0]);

  return {
    forecastCm: Math.round(forecastCm * 10) / 10,
    horizonDays: meta.horizon_days,
    asOfDate: rows[lastCompleteIndex].date,
  };
}
```

- [ ] **Step 3: Manually verify it runs**

Since this project has no test suite configured (`CLAUDE.md`: "There is no test suite configured in this repo"), verify with a one-off script instead of adding a new test framework:

Create a throwaway file `/tmp/verify_forecast.mjs` (or the project's scratchpad dir) with:

```javascript
import { forecastLevel } from "./src/lib/hydroForecast.ts";
const result = await forecastLevel(13076);
console.log(result);
```

Run it with `npx tsx /tmp/verify_forecast.mjs` from the project root.
Expected: prints an object like `{ forecastCm: 123.4, horizonDays: 3, asOfDate: "2023-12-28" }` — not `null`, and `forecastCm` should be a plausible level for this post (roughly 150-900 range based on the historical data seen during data exploration). Delete the throwaway file afterward.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hydroForecast.ts package.json package-lock.json
git commit -m "Add Node.js inference module for the hydro forecast model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: API route

**Files:**
- Create: `src/app/api/forecast/route.ts`

**Interfaces:**
- Consumes: `forecastLevel` from `src/lib/hydroForecast.ts` (Task 4).
- Produces: `GET /api/forecast?post_code=13076` → `200 { forecastCm, horizonDays, asOfDate }` or `404 { error }` if no model exists for that post.

- [ ] **Step 1: Write the implementation**

Create `src/app/api/forecast/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { forecastLevel } from "@/lib/hydroForecast";

export async function GET(request: NextRequest) {
  const postCodeParam = request.nextUrl.searchParams.get("post_code");
  const postCode = Number(postCodeParam);
  if (!postCodeParam || Number.isNaN(postCode)) {
    return NextResponse.json({ error: "post_code query param is required" }, { status: 400 });
  }

  const result = await forecastLevel(postCode);
  if (!result) {
    return NextResponse.json({ error: `No forecast model available for post ${postCode}` }, { status: 404 });
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Manually verify with the dev server**

Run: `npm run dev` (in one terminal), then in another:
`curl "http://localhost:3000/api/forecast?post_code=13076"`
Expected: `{"forecastCm":123.4,"horizonDays":3,"asOfDate":"2023-12-28"}` (actual number will vary).

Then: `curl "http://localhost:3000/api/forecast?post_code=99999"`
Expected: `404` with `{"error":"No forecast model available for post 99999"}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/forecast/route.ts
git commit -m "Add /api/forecast endpoint for the hydro forecast model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Chat tool integration

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Interfaces:**
- Consumes: `forecastLevel` from `src/lib/hydroForecast.ts` (Task 4); the existing `TOOLS` array and `executeTool` dispatcher already in this file (see `CLAUDE.md`'s description of the chat route's tool-calling architecture).

- [ ] **Step 1: Add the tool import**

At the top of `src/app/api/chat/route.ts`, add:

```typescript
import { forecastLevel } from "@/lib/hydroForecast";
```

- [ ] **Step 2: Add the tool definition**

In the `TOOLS` array (alongside the existing `filter_hydroposts`, `detect_low_water_risk`, etc. — see the array starting at the line documented in `CLAUDE.md` as `const TOOLS = [...]` around line 170), add:

```typescript
  {
    type: "function",
    function: {
      name: "get_hydro_forecast",
      description:
        "Краткосрочный прогноз уровня воды (на 3 дня вперёд) для гидропоста. Пока доступен только для поста 13076 (р. Нура, с. Кошкарбаева). ВЫЗЫВАЙ при: 'прогноз уровня', 'какой будет уровень', 'прогноз на несколько дней'.",
      parameters: {
        type: "object",
        properties: {
          post_code: { type: "number", description: "Код гидропоста" },
        },
        required: ["post_code"],
      },
    },
  },
```

- [ ] **Step 3: Add the executor**

Find the tool-dispatch logic (`executeTool` function, matched by `toolCall.function.name` in the agent loop). Add a case for `get_hydro_forecast`:

```typescript
    case "get_hydro_forecast": {
      const postCode = Number(args.post_code);
      const result = await forecastLevel(postCode);
      if (!result) {
        return { data: { error: `Прогноз для поста ${postCode} пока недоступен` }, mapUpdate: null };
      }
      return {
        data: {
          post_code: postCode,
          forecast_cm: result.forecastCm,
          horizon_days: result.horizonDays,
          as_of_date: result.asOfDate,
        },
        mapUpdate: null,
      };
    }
```

(Match this to the existing `switch`/`if-else` style already used by the other tool cases in this function — read the surrounding cases first and follow the same pattern rather than introducing a different dispatch style.)

- [ ] **Step 4: Manually verify end-to-end**

Run `npm run dev`, open the app in a browser, log in, open the chat panel, and ask: **"Какой прогноз уровня воды на посту 13076?"**

Expected: the assistant calls `get_hydro_forecast`, and the reply mentions a specific centimeter value and that it's a 3-day forecast as of a specific date. If it instead says it can't forecast, check the server logs for the actual tool-call error before assuming the model itself is broken — the app's chat route has both DeepSeek and local-LLM backends (see `LLM_BACKEND` env var), and this should work identically on either since the tool-calling mechanism is backend-agnostic.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "Wire hydro forecast model into the chat agent as a new tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Follow-on phases (explicitly not covered by this plan)

- **Scale to the other 18 posts** in the Nura basin batch (13056, 13061, 13064, 13065, 13066, 13077, 13078, 13085, 13087, 13090, 13091, 13105, 13142, 13148, 13150, 13152, 13153, 13190) — repeat Tasks 1-2 per post once this one is validated to work end-to-end. Consider generalizing `extract_data.py`/`train_model.py` to take `post_code` as a CLI argument instead of hardcoding 13076, at that point.
- **Long-term (seasonal) forecasting** — a genuinely different model: predicts total spring flood volume/peak for the upcoming season from winter snow-accumulation proxies (cumulative sub-zero degree-days, precipitation-as-snow totals), not daily lag features. Needs its own feature-engineering design, not a variant of Task 2.
- **Validation on the independent 2024-2026 period** mentioned in the roadmap — this plan's Task 3 validates on 2021-2023 (data already in hand). Once 2024-2026 data is obtained from Kazgidromet, re-run an equivalent of `validate_model.py` against it as the "true" independent validation the pilot roadmap calls for — this is a bigger deal than 2021-2023 since the model architecture/features may need revisiting if performance drops on genuinely unseen years the model's development had zero exposure to.
- **Incorporating upstream posts** (13061, 13064, 13065, 13066 are all upstream of 13076 on the same river) as features — a level rise upstream today often predicts a rise downstream in N days, which could meaningfully improve on this plan's single-post baseline. Deliberately deferred: `CLAUDE.md` notes the app's existing hydropost data has "NO information about which post is upstream/downstream" — that relationship would need to be established from the coordinates/river network (`{region}-waterways.json`) before it could be used as a model feature, which is its own piece of work.
