-- IMPORTANT: If plan limits change, update plan_action_limits AND app constants.
create or replace function public.consume_action(
  action_type text,
  quantity integer default 1,
  consume boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_profile public.profiles%rowtype;
  v_trial_active boolean;
  v_trial_total integer;
  v_trial_used integer;
  v_trial_remaining integer;
  v_addon_remaining integer;
  v_plan_limit integer;
  v_period_start date;
  v_usage_id uuid;
  v_import_count integer;
  v_translation_count integer;
  v_optimization_count integer;
  v_ai_messages_count integer;
  v_used integer;
  v_available integer;
  v_remaining integer;
  v_use_trial integer;
  v_use_addon integer;
  v_use_plan integer;
begin
  v_owner := auth.uid();
  if v_owner is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  if quantity is null or quantity <= 0 then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_quantity');
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_owner;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'profile_missing');
  end if;

  v_trial_active := v_profile.trial_ends_at is not null and v_profile.trial_ends_at > now();

  if coalesce(v_profile.ai_disabled, false) and action_type in ('translation', 'optimization', 'ai_message') then
    return jsonb_build_object('allowed', false, 'reason', 'ai_disabled');
  end if;

  if action_type = 'import' then
    v_plan_limit := case when v_profile.plan = 'premium' then 25 else 0 end;
    v_trial_total := coalesce(v_profile.trial_imports, 0);
    v_trial_used := coalesce(v_profile.trial_imports_used, 0);
    v_addon_remaining := coalesce(v_profile.addon_imports, 0);
  elsif action_type = 'translation' then
    v_plan_limit := case when v_profile.plan = 'premium' then 25 else 0 end;
    v_trial_total := coalesce(v_profile.trial_translations, 0);
    v_trial_used := coalesce(v_profile.trial_translations_used, 0);
    v_addon_remaining := coalesce(v_profile.addon_translations, 0);
  elsif action_type = 'optimization' then
    v_plan_limit := case when v_profile.plan = 'premium' then 25 else 0 end;
    v_trial_total := coalesce(v_profile.trial_optimizations, 0);
    v_trial_used := coalesce(v_profile.trial_optimizations_used, 0);
    v_addon_remaining := coalesce(v_profile.addon_optimizations, 0);
  elsif action_type = 'ai_message' then
    v_plan_limit := case
      when v_profile.plan = 'premium' then 150
      when v_profile.plan = 'base' then 0
      else 0
    end;
    v_trial_total := coalesce(v_profile.trial_ai_messages, 0);
    v_trial_used := coalesce(v_profile.trial_ai_messages_used, 0);
    v_addon_remaining := coalesce(v_profile.addon_ai_messages, 0);
  else
    return jsonb_build_object('allowed', false, 'reason', 'unknown_action');
  end if;

  v_trial_remaining := case
    when v_trial_active then greatest(coalesce(v_trial_total, 0) - coalesce(v_trial_used, 0), 0)
    else 0
  end;

  v_period_start := date_trunc('month', now())::date;

  select id,
         import_count,
         coalesce(translations_count, 0),
         coalesce(optimizations_count, 0),
         coalesce(ai_messages_count, 0)
  into v_usage_id, v_import_count, v_translation_count, v_optimization_count, v_ai_messages_count
  from public.usage_monthly
  where owner_id = v_owner and period_start = v_period_start
  limit 1;

  if v_usage_id is null then
    insert into public.usage_monthly (
      id,
      owner_id,
      period_start,
      import_count,
      translations_count,
      optimizations_count,
      ai_messages_count,
      ai_tokens,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_owner,
      v_period_start,
      0,
      0,
      0,
      0,
      0,
      now(),
      now()
    )
    returning id, import_count, translations_count, optimizations_count, ai_messages_count
    into v_usage_id, v_import_count, v_translation_count, v_optimization_count, v_ai_messages_count;
  end if;

  if action_type = 'import' then
    v_used := coalesce(v_import_count, 0);
  elsif action_type = 'translation' then
    v_used := coalesce(v_translation_count, 0);
  elsif action_type = 'optimization' then
    v_used := coalesce(v_optimization_count, 0);
  else
    v_used := coalesce(v_ai_messages_count, 0);
  end if;

  v_available := coalesce(v_plan_limit, 0) + coalesce(v_addon_remaining, 0) + coalesce(v_trial_remaining, 0);

  if v_used + quantity > v_available then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'limit_reached',
      'available', greatest(v_available - v_used, 0)
    );
  end if;

  if not consume then
    return jsonb_build_object(
      'allowed', true,
      'available', greatest(v_available - v_used, 0)
    );
  end if;

  if action_type = 'import' then
    update public.usage_monthly
      set import_count = import_count + quantity,
          updated_at = now()
      where id = v_usage_id;
  elsif action_type = 'translation' then
    update public.usage_monthly
      set translations_count = translations_count + quantity,
          updated_at = now()
      where id = v_usage_id;
  elsif action_type = 'optimization' then
    update public.usage_monthly
      set optimizations_count = optimizations_count + quantity,
          updated_at = now()
      where id = v_usage_id;
  else
    update public.usage_monthly
      set ai_messages_count = ai_messages_count + quantity,
          updated_at = now()
      where id = v_usage_id;
  end if;

  v_remaining := quantity;
  v_use_trial := 0;
  v_use_addon := 0;
  v_use_plan := 0;

  if v_trial_active and v_trial_remaining > 0 then
    v_use_trial := least(v_remaining, v_trial_remaining);
    v_remaining := v_remaining - v_use_trial;
  end if;

  if v_remaining > 0 and v_addon_remaining > 0 then
    v_use_addon := least(v_remaining, v_addon_remaining);
    v_remaining := v_remaining - v_use_addon;
    v_addon_remaining := v_addon_remaining - v_use_addon;
  end if;

  v_use_plan := v_remaining;

  if action_type = 'import' then
    update public.profiles
      set trial_imports_used = coalesce(trial_imports_used, 0) + v_use_trial,
          addon_imports = v_addon_remaining
      where id = v_owner;
  elsif action_type = 'translation' then
    update public.profiles
      set trial_translations_used = coalesce(trial_translations_used, 0) + v_use_trial,
          addon_translations = v_addon_remaining
      where id = v_owner;
  elsif action_type = 'optimization' then
    update public.profiles
      set trial_optimizations_used = coalesce(trial_optimizations_used, 0) + v_use_trial,
          addon_optimizations = v_addon_remaining
      where id = v_owner;
  else
    update public.profiles
      set trial_ai_messages_used = coalesce(trial_ai_messages_used, 0) + v_use_trial,
          addon_ai_messages = v_addon_remaining
      where id = v_owner;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'used_trial', v_use_trial,
    'used_addon', v_use_addon,
    'used_plan', v_use_plan
  );
end;
$$;

grant execute on function public.consume_action(text, integer, boolean) to authenticated;
