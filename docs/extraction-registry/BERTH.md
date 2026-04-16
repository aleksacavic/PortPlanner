# BERTH

**Version:** 1.0.0

A berth line representing a vessel mooring position with associated water
depth and design vessel specification. Vessel traffic modelling is deferred;
this object captures the static berth infrastructure and its draft envelope.

## Inputs

### Geometry

| Field | Type | Notes |
|---|---|---|
| `geometry.line` | {p1: Point2D, p2: Point2D} | Berth face in project-local metric |
| `geometry.length_m` | number | `distance(p1, p2)` |

### Parameters

| Field | Type | Default | Notes |
|---|---|---|---|
| `berth_type` | enum | `container` | `container` \| `bulk` \| `ro_ro` \| `multipurpose` |
| `design_vessel_loa_m` | number | 300 | Length overall of the design vessel |
| `design_vessel_beam_m` | number | 45 | Beam of the design vessel |
| `design_draft_m` | number | 14 | Design draft of the vessel (metres) |
| `water_depth_m` | number | 16 | Depth at chart datum at the berth |
| `tide_range_m` | number | 1.5 | Tidal range at this location |
| `bollard_spacing_m` | number | 25 | Distance between mooring bollards |
| `fender_spacing_m` | number | 15 | Distance between fenders |
| `crane_rail_spacing_m` | number | 30.48 | Gauge of ship-to-shore crane rails |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `berth_length_m` | number | m | `geometry.length_m` |
| `effective_berth_count` | number | berths | `floor(length_m / (design_vessel_loa_m × 1.1))` |
| `bollard_count` | number | units | `ceil(length_m / bollard_spacing_m) + 2` |
| `fender_count` | number | units | `ceil(length_m / fender_spacing_m)` |
| `available_underkeel_m` | number | m | `water_depth_m + tide_range_m × 0.5 - design_draft_m` |
| `crane_positions` | number | positions | `floor(length_m / 50)` for container berths, else 0 |
| `crane_rail_length_m` | number | m | `length_m × 2` for container berths (two parallel rails) |
| `apron_area_m2` | number | m² | `length_m × 40` (assumes 40m apron depth standard) |

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `BERTH_UNDERKEEL_CRITICAL` | OBJECT | ERROR | `available_underkeel_m < 0.5` |
| `BERTH_UNDERKEEL_TIGHT` | OBJECT | WARNING | `available_underkeel_m < 1.0` |
| `BERTH_TOO_SHORT` | OBJECT | ERROR | `length_m < design_vessel_loa_m × 1.05` |
| `BERTH_ADJACENT_BEAM_CLEARANCE` | RELATIONSHIP | WARNING | Adjacent berth within `design_vessel_beam_m × 1.5` |
| `BERTH_BACKS_ONTO_BUILDING` | RELATIONSHIP | WARNING | Building within 20m of berth face |
| `BERTH_APRON_WIDTH` | RELATIONSHIP | ERROR | Apron depth less than 30m for container berths |

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |

## Notes

Vessel traffic, throughput-per-vessel-class, and operational utilisation
modelling are deferred. This extractor captures only the static berth
infrastructure. When vessel modelling is added (future ADR), this
extractor will extend to produce additional outputs without breaking
existing consumers.
