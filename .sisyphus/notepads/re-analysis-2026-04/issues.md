# Re-Analysis Issues (2026-04)

## Known from Previous Analysis
- calculateDeliveryPricing: auth missing (P0)
- Storage /users/{userId}/ public read (P0)
- beta1-orchestration: 1,756 lines monolith
- Core services without tests: wallet, payment, settlement, chat, verification, locker, orchestration
- Circular deps: request→matching→delivery→orchestration
- ~10 potentially unused services
- 5 dead type files
