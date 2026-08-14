# M8 Demo and Viva Rehearsal

## Five-minute demo

1. Open one passenger browser as Nusrat, one incognito driver browser as
   Rafiq, and the admin console as Ayesha.
2. Show Ayesha's dashboard, payout/dispute/SOS queues, and the append-only
   audit viewer. Acknowledge the seeded SOS but do not resolve it yet.
3. Put Rafiq online. Book from Nusrat, accept from Rafiq, then demonstrate
   arrive → start → GPS/chat → complete.
4. Show the receipt, wallet ledger, driver earnings, and platform revenue.
   Explain that money is `NUMERIC`, JSON money is a string, and ledger rows
   cannot be updated or deleted by trigger.
5. Raise a support ticket and resolve a dispute. Finish with `npm test` green
   and the live health endpoint.

## Design presentation flow (doc 01 §14)

- Domain map: 51 entities grouped into seven subsystems.
- Ride story: request → offer fan-out → `FOR UPDATE` accept → trip/history →
  payment/ledger.
- One relationship in depth: state cardinality, participation, FK, delete
  rule, and why that rule protects history.
- Master diagram: show breadth without narrating every table.
- Close on snapshot-versus-reference, append-only ledgers, and why pickup
  locations are ride facts rather than a normalized reusable entity.

## Questions to rehearse aloud

- Why `ride_requests`, `ride_offers`, and `trips` are separate: demand,
  marketplace attempts, and fulfillment have different lifecycles.
- Why the accept race is safe: lock the request, re-check state, then insert;
  a unique trip/request constraint is the final backstop.
- Why cached wallet balance is trustworthy: every ledger insert locks and
  updates the wallet in one transaction; `fn_wallet_balance_audit` recomputes
  the independent truth.
- Why pricing is effective-dated: a new card explains future quotes while a
  completed trip keeps its immutable fare snapshot.
- Why JWT roles are not enough for admin actions: `admin_profiles.access_level`
  is re-read for finance/ops/support decisions and every mutation is audited.
- How IDOR is prevented: participant/owner checks happen in services and use
  404 for someone else's resource.
- Why SOS is not rate-limited: safety must fail open for repeated legitimate
  distress; it is authenticated, location-frozen, visible in the admin queue,
  and permanently attributable.
- What was deliberately cut: scheduled/multi-stop UI, PDF receipts, polygon
  editor, and real SOS SMS fan-out; their schema seams remain explicit.
