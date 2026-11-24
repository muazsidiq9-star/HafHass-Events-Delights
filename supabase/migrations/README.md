# Supabase migration archive

Project: HAFHASS Events & Delights  
Project ref: `gbsvwizlplzoantvkese`

## Important: migration history reconciliation

The live Supabase project currently reports the 21 migration versions listed below as applied.

At the time this archive was prepared, the GitHub `main` branch contained only the final migration SQL file:

- `20261124143038_notification_consistency_phase_3.sql`

The original SQL bodies for the preceding 20 migrations were not present in the repository history or recoverable from the available prior project notes. **They are intentionally not recreated from their names or guessed.** A migration filename and its description are not a safe substitute for its original SQL.

This README is an inventory only. It is not executable SQL and must not be treated as a migration or used to mark migrations as applied.

## Applied migration inventory

| Version | Name | SQL file in GitHub |
|---|---|---|
| 20261112115832 | secure_admin_bank_transfer_verification | Missing — original SQL not recovered |
| 20261112115844 | use_existing_bank_transfer_review_rpc | Missing — original SQL not recovered |
| 20261113170704 | add_business_subtitle_to_business_settings | Missing — original SQL not recovered |
| 20261115163046 | create_delivery_location_directory | Missing — original SQL not recovered |
| 20261117072708 | make_address_line_1_optional | Missing — original SQL not recovered |
| 20261117090812 | make_checkout_address_line_1_optional | Missing — original SQL not recovered |
| 20261119085929 | enable_payments_realtime_updates | Missing — original SQL not recovered |
| 20261119173535 | add_store_image_settings_and_assets | Missing — original SQL not recovered |
| 20261123103316 | secure_admin_customer_notifications | Missing — original SQL not recovered |
| 20261123160625 | create_customer_push_subscriptions | Missing — original SQL not recovered |
| 20261123171913 | enable_automatic_firebase_push_dispatch | Missing — original SQL not recovered |
| 20261123171953 | trigger_automatic_push_for_notifications | Missing — original SQL not recovered |
| 20261124072628 | add_idempotent_admin_notifications | Missing — original SQL not recovered |
| 20261124073502 | tighten_push_subscription_and_dispatch_grants | Missing — original SQL not recovered |
| 20261124075207 | add_durable_push_dispatch_retries | Missing — original SQL not recovered |
| 20261124075216 | persist_push_dispatch_jobs_before_webhook | Missing — original SQL not recovered |
| 20261124075238 | add_admin_push_dispatch_monitor_and_correct_webhook | Missing — original SQL not recovered |
| 20261124075256 | index_push_dispatch_retry_schedule | Missing — original SQL not recovered |
| 20261124080003 | add_safe_partial_push_dispatch_marker | Missing — original SQL not recovered |
| 20261124080043 | avoid_automatic_replay_of_uncertain_push_claims | Missing — original SQL not recovered |
| 20261124143038 | notification_consistency_phase_3 | Present |

## Safe handling from here

1. Do not reapply any of the already-applied versions to production.
2. Do not create placeholder SQL files bearing the missing historical version numbers. Supabase CLI could interpret those as real migrations even though their contents are incomplete.
3. Keep the live database and its migration history intact.
4. For a reproducible new environment, first produce and review a schema-only baseline from the live project using the Supabase CLI/database dump workflow. Review required schemas, extensions, grants, RLS policies, triggers, functions, and storage configuration before treating that snapshot as a baseline.
5. Keep future changes as timestamped SQL files in this directory and apply them through the normal migration workflow.

The live database's migration history is the record of what was applied. This repository archive documents the gap transparently rather than claiming to contain SQL that is unavailable.
