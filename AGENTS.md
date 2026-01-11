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

## Global recipe cache vs user recipes (imports + language)
We now keep a strict separation between **global (shared) imports** and **user-owned copies** to protect privacy and allow later global browsing.

### Tables + columns (DB)
- **`public.global_recipes`** (shared, neutral, original language only)
  - Core: `source_url`, `source_url_normalized`, `source_domain`, `source_platform`
  - Content: `title`, `description`, `meal_type`, `difficulty`, `prep_time`, `cook_time`, `total_time`, `servings`
  - Nutrition: `nutrition_calories`, `nutrition_protein`, `nutrition_carbs`, `nutrition_fat`
  - Media: `media_video_url`, `media_image_url`
  - Content arrays: `tags` (text[]), `ingredients` (jsonb), `steps` (jsonb)
  - Language + quality: `language_code`, `quality_score`, `is_complete`, `missing_fields`, `last_fetched_at`
  - Versioning: `canonical_hash`, `canonical_group_id`, `supersedes_id`
- **`public.recipes`** (user-owned)
  - Added: `global_recipe_id` (fk to `global_recipes`), `language_code` (user copy language)
  - Still contains all private/user data: `notes`, edits, approvals, tags, favorites, etc.

### Backend logic (single import entry point)
- **Cache decision + scoring** lives in `backend/app/services/import_cache.py`
  - `normalize_url`, `detect_language`, `score_recipe`, `should_reimport`
  - Rules: re-import if incomplete, low quality, or stale (`FRESH_DAYS`)
- **Import endpoints** call `import_with_cache(...)`:
  - `backend/app/api/routes.py` → `/import/web|tiktok|instagram|pinterest|youtube`
  - Returns original-language recipe + `globalRecipeId`, `languageCode`, `cacheHit`
- **Scan import** does **not** cache globally; it only returns `languageCode`.

### Mobile wiring
- `apps/mobile/src/services/importApi.ts` consumes `globalRecipeId` + `languageCode`
- `apps/mobile/src/services/supabaseData.ts` saves them on `public.recipes`
- `apps/mobile/src/data/types.ts` includes `globalRecipeId`, `languageCode`

### Policy rules
- Import **always** uses original language from URL/source.
- Translation/optimization **always** happens on user copy (`public.recipes`).
- Global layer never stores user notes, edits, approvals, or personal tags.

### If you change logic later
Update all of:
- DB schema (`public.global_recipes`, `public.recipes` columns)
- Backend cache rules in `backend/app/services/import_cache.py`
- Import endpoints in `backend/app/api/routes.py`
- Mobile models + save mapping (`importApi.ts`, `supabaseData.ts`, `types.ts`)
