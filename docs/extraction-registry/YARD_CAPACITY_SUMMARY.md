# YARD_CAPACITY_SUMMARY

**Version:** 1.0.0

Project-level cross-object extractor that aggregates all RTG_BLOCK objects
and the operational assumptions to produce yard capacity metrics.

This is a **cross-object extractor** — it consumes outputs from other
extractors and project-level operational assumptions.

## Inputs

### From RTG_BLOCK extractors

Aggregated across all RTG_BLOCK objects in the project scenario:

| Field | Type | Source |
|---|---|---|
| `total_ground_slots` | number | Sum of `teu_slots` from all blocks |
| `total_stack_capacity` | number | Sum of `stack_capacity_teu` from all blocks |
| `total_yard_area_m2` | number | Sum of `gross_area_m2` from all blocks |

### From operational assumptions

| Field | Type | Default | Notes |
|---|---|---|---|
| `peak_factor` | number | 1.3 | Peak-to-average throughput ratio |
| `dwell_days` | number | 5 | Average container dwell time |
| `reefer_percentage` | number | 0.10 | Fraction of slots that are reefer |
| `empty_percentage` | number | 0.20 | Fraction of throughput that is empty containers |
| `transshipment_percentage` | number | 0.30 | Fraction of throughput that is transshipment |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `total_ground_slots` | number | TEU | Sum across all RTG_BLOCK |
| `total_stack_capacity_teu` | number | TEU | Sum across all RTG_BLOCK |
| `yard_area_gross_m2` | number | m² | Sum across all RTG_BLOCK |
| `throughput_capacity_teu_pa` | number | TEU/year | See formula below |
| `reefer_slots` | number | slots | `total_ground_slots × reefer_percentage` |
| `laden_capacity_teu_pa` | number | TEU/year | `throughput_capacity_teu_pa × (1 - empty_percentage)` |
| `effective_density_teu_ha` | number | TEU/ha | `total_stack_capacity_teu / (yard_area_gross_m2 / 10000)` |

### Throughput capacity formula

The yard's annual throughput capacity is limited by ground slot turnover:

```
throughput_capacity_teu_pa =
  (total_ground_slots × 365) / (dwell_days × peak_factor)
```

This represents the maximum sustainable annual throughput given the
ground slot constraint and operational factors. Transshipment containers
typically count as two throughput moves (in and out) but use only one
ground slot period; this refinement is captured in the detailed throughput
model (separate from this extractor).

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `YARD_THROUGHPUT_VS_TARGET` | PROJECT | WARNING | Project throughput target exceeds `throughput_capacity_teu_pa` |
| `YARD_REEFER_INSUFFICIENT` | PROJECT | WARNING | `reefer_slots < project_reefer_demand` |
| `YARD_DENSITY_UNUSUAL` | PROJECT | INFO | `effective_density_teu_ha` outside typical range (500-2000) |

## Dependencies

This extractor depends on:
- All RTG_BLOCK extractors (must have run successfully)
- Project operational assumptions being set

If any RTG_BLOCK has extractor warnings, this summary propagates them.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |
