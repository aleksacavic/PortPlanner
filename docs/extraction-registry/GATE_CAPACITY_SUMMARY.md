# GATE_CAPACITY_SUMMARY

**Version:** 1.0.0

Project-level cross-object extractor that aggregates ROAD objects
classified as gate-related and the operational assumptions to produce gate
throughput metrics.

## Inputs

### From ROAD extractors

All ROAD objects where `classification ∈ {GATE_APPROACH, GATE_INBOUND, GATE_OUTBOUND}`:

| Field | Type | Source |
|---|---|---|
| `inbound_lanes_total` | number | Sum of `lanes_per_dir` on GATE_INBOUND roads |
| `outbound_lanes_total` | number | Sum of `lanes_per_dir` on GATE_OUTBOUND roads |
| `gate_approach_length_m` | number | Sum of `length_m` on GATE_APPROACH roads |

### From operational assumptions

| Field | Type | Default | Notes |
|---|---|---|---|
| `truck_turnaround_minutes` | number | 25 | Time per truck through gate |
| `operating_hours_per_day` | number | 16 | Gate operational hours |
| `operating_days_per_year` | number | 310 | Operating days accounting for holidays |
| `average_teu_per_truck` | number | 1.3 | Accounts for mix of single and dual-container moves |
| `peak_hour_factor` | number | 1.5 | Peak hour throughput vs average |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `inbound_lanes` | number | lanes | `inbound_lanes_total` |
| `outbound_lanes` | number | lanes | `outbound_lanes_total` |
| `gate_capacity_trucks_per_hour` | number | trucks/hr | See formula below |
| `gate_capacity_trucks_per_day` | number | trucks/day | `trucks_per_hour × operating_hours_per_day` |
| `gate_capacity_teu_per_day` | number | TEU/day | `trucks_per_day × average_teu_per_truck` |
| `gate_capacity_teu_per_year` | number | TEU/year | `teu_per_day × operating_days_per_year` |
| `peak_hour_capacity_trucks` | number | trucks/hr | `trucks_per_hour / peak_hour_factor` |

### Gate capacity formula

```
trucks_per_hour = min(inbound_lanes, outbound_lanes) × (60 / truck_turnaround_minutes)
```

The `min()` reflects that a truck movement requires both an inbound and
outbound lane; the bottleneck is whichever direction has fewer lanes.

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `GATE_CAPACITY_VS_YARD` | PROJECT | WARNING | `gate_capacity_teu_per_year < yard_throughput_capacity_teu_pa × 0.95` |
| `GATE_LANE_IMBALANCE` | PROJECT | INFO | `|inbound_lanes - outbound_lanes| > 2` |
| `GATE_NO_CAPACITY` | PROJECT | ERROR | `inbound_lanes = 0 ∨ outbound_lanes = 0` |

## Dependencies

This extractor depends on:
- ROAD objects being classified (GATE_APPROACH, GATE_INBOUND, GATE_OUTBOUND)
- Project operational assumptions being set

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |
