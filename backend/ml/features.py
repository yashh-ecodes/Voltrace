"""
Voltrace feature engineering.

The same six features are computed (a) from NASA PCoE laboratory cycling data for
training and (b) from a smart-BMS guided load test inside the app. Features are made
chemistry-normalised (scale-free) so that a model trained on 2 Ah 18650 lab cells can be
applied to EV traction packs. That transfer is an engineering assumption which the
proposal's field-validation phase is designed to test.

    cycle_frac      cycles / reference cycle life of the chemistry (cycles to ~80% SoH)
    r_growth        DC internal resistance (R = dV/dI at load step) / chemistry reference R
    recovery_ratio  voltage recovered after load removal / voltage sag at load step
    slope_rel       loaded-voltage slope (mV/s per C) / chemistry reference slope
    avg_temp_c      mean temperature during the test
    bms_soh         State of Health reported by the BMS (capacity remaining / rated)
"""
from __future__ import annotations

FEATURES = ["cycle_frac", "r_growth", "recovery_ratio", "slope_rel", "avg_temp_c", "bms_soh"]

# Reference values per chemistry. "cycle_life" is cycles to ~80% SoH under rated
# conditions; r_ref is capacity-normalised DC resistance (mOhm * Ah) of a new cell;
# slope_ref is the early loaded-voltage slope of a new cell (mV/s per C).
CHEMISTRY_REF = {
    # NASA PCoE 18650 (2.0 Ah LCO/NMC) under aggressive 1C-2C lab cycling.
    "NASA18650": {"cycle_life": 150, "r_ref": 300.0, "slope_ref": 1.0},
    "LFP": {"cycle_life": 3000, "r_ref": 80.0, "slope_ref": 0.35},
    "NMC": {"cycle_life": 1000, "r_ref": 120.0, "slope_ref": 0.6},
}
