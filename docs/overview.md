# System Overview

## What this platform is

A port layout intelligence platform. Planners draw port infrastructure in 2D.
The system extracts operational quantities from the geometry, runs validation
and throughput analysis, computes capex and revenue, and reports inconsistencies
back to the geometry layer. 3D is a derived view for spatial validation and
presentation.

It is not a drawing tool. It is not a simulator. It is not a costing spreadsheet.
Those tools already exist. This platform closes the loop between them.

## The core loop

```
geometry → quantity extraction → equipment derivation → operational parameters
  → throughput + capex + revenue → validation → back to geometry as constraint
```

Every architectural decision is evaluated against this loop. Does the decision
make the loop cleaner, faster, more auditable, more interactive? If not, it is
deprioritised.

## What is authoritative vs derived

**Authoritative:** the 2D project document. Object geometry, classification,
parameters, and ownership state. Nothing else is source of truth.

**Derived:** extracted quantities, operational analysis, cost computations,
validation results, 3D scene, visual projections on the basemap. All of these
are deterministic functions of the authoritative document plus scenario
overrides and library rates.

## Scope

**In scope:** port topside layout — roads, pavements, buildings, container
stacks (RTG blocks), berth lines, gate complexes, utility corridors, and the
throughput/capex/revenue analysis derived from them.

**Deferred:** vessel traffic modelling, bathymetric analysis, tidal modelling,
temporal phasing of construction, external API, real-time multi-user editing,
geometry branching across scenarios.

**Out of scope:** navigational channel design, marine structural engineering,
geotechnical analysis, detailed MEP design.

## Why it matters

Every port planner today works with AutoCAD plus Excel plus a capex spreadsheet
plus a throughput model in another tool. None of these talk to each other. A
layout change in AutoCAD does not propagate to the capex estimate. A capacity
assumption in the throughput model does not validate against the yard geometry.
The result is that plans are internally inconsistent, slow to iterate, and
painful to audit.

This platform closes that loop. The primary differentiation over existing tools
is not better drawing. It is the fact that the system can say "your RTG block
exceeds the 250m operational maximum" or "your throughput target requires 45%
more ground slots than your yard provides" — and it can say it the moment the
layout changes, not weeks later.
