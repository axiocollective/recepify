# Agent Notes

## Plan limits: single source updates
Plan limits live in the database table `public.plan_action_limits`.

When changing any plan limits (trial/base/premium action counts), update:
- **DB single source**:
  - `public.plan_action_limits` rows
  - Function `public.consume_action` uses this table (see `supabase/migrations/20260111_plan_limits_table.sql`)
  - Re-run the SQL in Supabase to apply the function/table changes
- **App constants & copy**:
  - `apps/mobile/src/data/usageLimits.ts` (plan action limits)
  - `apps/mobile/src/data/AppContext.tsx` (trial constants)
  - UI copy: `apps/mobile/src/components/ChoosePlanScreen.tsx` and `apps/mobile/src/components/PlanBilling.tsx`

If trial limits change, consider backfilling existing trial totals in `public.profiles`.
