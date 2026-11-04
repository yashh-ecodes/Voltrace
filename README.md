# Voltrace — Know Your Battery. Trust Its Future.

AI battery intelligence and digital battery passport app for lithium-ion EV packs.
Built for **BITS Pilani InnoStorm 2026**. Mobile-first PWA, packaged for Android with Capacitor.

```
frontend/   React + TypeScript + Vite + Tailwind PWA (the mobile app) + Capacitor Android project
backend/    FastAPI model + signing service, ML training pipeline, Supabase schema
```

## What works

| Area | Implementation |
|---|---|
| Live BMS scan | Web Bluetooth (Chrome/Edge on Android) and native BLE in the Android app (`@capacitor-community/bluetooth-le`). JBD and Daly protocol adapters (`src/ble/protocols.ts`), live readings, guided 20 s load test. Nothing is faked: unsupported browsers are told why. |
| Demo mode | 3 reproducible battery profiles (healthy / aged / faulty) generated from an equivalent-circuit pack model, run through the **same** models as live data. |
| SoH | **Real XGBoost** multi-quantile model (5/50/95%) trained on the **NASA PCoE battery ageing dataset**, battery-wise split. Held-out MAE **3.65 SoH points**; 90% interval coverage 89%; trusting the BMS figure alone gives MAE 13.8. Exported tree JSON is evaluated on-device (parity with xgboost ≤ 0.05) and by the API. |
| Safety | **Real Isolation Forest** (scikit-learn, exported) on per-cell robust deviations from the pack median + rule thresholds (50 mV spread, etc.). Fault-injection validation: 100% detection at high severity for self-discharge, resistance rise and hotspot; 7.5% false alarms on healthy packs. Green / Amber / Red with suspect cell. |
| Passport | Canonical JSON → SHA-256 → **Ed25519** signature by the FastAPI service (private key stays in `backend/keys/`). QR carries the compressed signed record, so any phone verifies offline with the public key. A4 PDF export, share, copy link. |
| Verification | Camera QR scanning (BarcodeDetector → jsQR fallback), image upload, manual code entry. VERIFIED / INVALID / UNAVAILABLE. Tamper lab produces a tampered QR that fails on a second phone. |
| Fleet, analytics, learn | 10-battery fleet with scan histories (all computed by the engine), risk-rise alerts, charts, 16 Learn topics, glossary info buttons everywhere. |
| Judge demo | Floating 16-step guide that auto-advances as the judge uses the app; Reset Demo. |

## Honest limitations

* **Offline demo signing**: if the signing server is unreachable, the app can sign with a *separate, publicly-known demonstration key* (`vt-demo-offline`) so a judge demo never breaks. Such passports are always labelled "demo key" when verified. Turn it off in Settings; the production issuer key never leaves the backend.
* `bms_soh` training input is synthesised from NASA capacity labels (NASA lab data has no BMS). Transfer from 18650 lab cells to EV packs uses chemistry-normalised features and is **unvalidated until field trials**.
* Safety validation uses synthetic fault injection, not real failing packs. Voltrace is a screening tool, not a certified safety assessment.
* CALCE data needs registration; `load_calce()` is the integration point.

## Deploy on Render (one service: app + API)

1. In Render, open **New → Blueprint** and pick this GitHub repo. `render.yaml` sets up a Docker web service on the free plan.
2. Render generates `VOLTRACE_SIGNING_SEED` once. The Ed25519 signing key is derived from it, so it survives restarts and never appears in the repo. Do not change it: passports signed with the old key would stop verifying.
3. When the build finishes, open `https://<service>.onrender.com`. QR codes automatically point to that address.

On the free plan the service sleeps after about 15 minutes idle and takes roughly 30–60 seconds to wake. Open it a minute before judging. The SQLite passport store is ephemeral there; QR verification still works because each QR carries the signed record. Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to keep passports permanently.

## Run it

```bash
cd backend && pip install -r requirements.txt
```

```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

The dev server proxies `/api` to `:8000`. For a single deployable service, run `npm run build` in `frontend/`; FastAPI then serves `frontend/dist` at `/` alongside the API.

**For the competition**, host it on HTTPS (Render, Railway, Fly.io…) so that Web Bluetooth and camera work and a second phone can open passport QR links. If the QR would point to `localhost`, the app warns you; set the public URL in *Settings → Passport QR links* or via `VITE_PUBLIC_URL`.

Signing key: generated at `backend/keys/issuer_ed25519.pem` on first start, or supplied via `VOLTRACE_SIGNING_KEY_PEM`. If you rotate it, update the public key in `frontend/src/lib/trust.ts` (the app also fetches `/api/keys`).

Supabase: apply `backend/supabase/schema.sql`, set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`; otherwise a local SQLite file is used.

### Android APK

```bash
cd frontend && VITE_PUBLIC_URL=https://your-host/ npm run build && npx cap sync android
```

Then open `frontend/android` in Android Studio and choose *Build → Build APK(s)*. BLE and camera permissions are already declared in the manifest.

### Retrain the models

```bash
cd backend && python -m ml.train_soh && python -m ml.train_iforest
```

Then copy `backend/models/*.json` to `frontend/src/ml/models/`. NASA data goes in `backend/data/raw/5. Battery Data Set/extracted/`, downloaded from <https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip>.

## Tests

```bash
cd backend && python -m pytest -q
```

```bash
cd frontend && npm run check
```

The pytest suite covers signing, tamper rejection and diagnosis. `npm run check` covers model parity, demo profiles, fleet consistency and the JBD/Daly parsers.
