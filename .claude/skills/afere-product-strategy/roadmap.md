# Afere Product Roadmap

This document is the source of truth for roadmap awareness within the `afere-product-strategy` skill.

When evaluating features, cross-reference the active milestone. Features that fit the current milestone receive higher priority. Features that belong to a future milestone should be logged as backlog — not scheduled — unless they are architectural prerequisites.

---

## Active Milestone — v2.2.x

**Theme: Persistence & Sharing**

The current focus is on giving users a reason to return and making Afere's output shareable beyond the session.

| Feature              | Status       | Notes                                      |
|----------------------|--------------|--------------------------------------------|
| Saved Calculations   | In Progress  | Local persistence of named calculation sets |
| Calculation History  | Planned      | Chronological log of past valuations        |
| Premium Sharing      | Planned      | Shareable report links with access controls |

**Guiding principle for v2.2.x:** Every feature should either persist user work or extend Afere's reach beyond the calculator session.

---

## Next Milestone — v2.3.x

**Theme: Output & Intelligence**

The focus shifts to making Afere's output more professional and its insights more actionable.

| Feature              | Status   | Notes                                          |
|----------------------|----------|------------------------------------------------|
| PDF Reports          | Planned  | Exportable, branded honorarium report           |
| Favorites            | Planned  | Pinned procedures for fast recall               |
| Statistics           | Planned  | Per-procedure and aggregate valuation insights |

**Guiding principle for v2.3.x:** Every feature should make the output of a calculation more useful, credible, or shareable with third parties (hospitals, insurers, administrators).

---

## Future Milestone — v3.x

**Theme: Identity & Monetization**

This milestone introduces the subscription infrastructure and user account system. It is a platform-level investment that unlocks server-side persistence, billing, and personalization.

| Feature             | Status     | Notes                                           |
|---------------------|------------|-------------------------------------------------|
| Authentication      | Planned    | Email/OAuth login                               |
| User Accounts       | Planned    | Profile, preferences, account management         |
| Subscription Model  | Planned    | Freemium tiers gating premium features           |

**Guiding principle for v3.x:** This is infrastructure, not a feature milestone. No user-facing features should be gated on this milestone unless they are strictly impossible without authentication.

---

## Backlog (Unscheduled)

Features that have been evaluated and deferred. Not rejected — but not yet assigned to a milestone.

| Feature                         | Rationale for Deferral                              |
|---------------------------------|-----------------------------------------------------|
| Multi-user Collaboration        | Requires v3.x auth infrastructure                   |
| TUSS Code Support               | High complexity; separate codebook from CBHPM        |
| Mobile App (iOS/Android)        | Significant platform investment; web-first strategy |
| Hospital Integration API        | Pushes toward ERP territory; re-evaluate at v3.x    |
| AI Procedure Suggestion         | Promising; requires usage data from v2.2.x first    |

---

## Positioning Constraints

Regardless of roadmap phase, the following categories are permanently out of scope unless the product strategy is fundamentally revised:

- Patient records or clinical data storage
- Appointment scheduling
- CRM or communication features
- Accounting or ERP integrations
- Features that require Afere to hold PII beyond account identity

Any feature that touches these areas must be escalated to a full positioning review before evaluation proceeds.
