--
-- PostgreSQL database dump
--

\restrict LaDEtQwzNmuTkqNTmZYks484j8bgc1U2RmOuVqha4feZujnd8yFZOIicyj2LM2B

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: import_usage_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_usage_monthly (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    period_start date NOT NULL,
    source character varying NOT NULL,
    import_count integer NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredient (
    line character varying NOT NULL,
    amount character varying,
    name character varying,
    id uuid NOT NULL,
    recipe_id uuid NOT NULL
);


--
-- Name: instructionstep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instructionstep (
    step_number integer NOT NULL,
    text character varying NOT NULL,
    id uuid NOT NULL,
    recipe_id uuid NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text,
    language text,
    country text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ai_disabled boolean DEFAULT false,
    plan text,
    bonus_imports integer DEFAULT 0 NOT NULL,
    bonus_tokens integer DEFAULT 0 NOT NULL,
    subscription_period text DEFAULT 'yearly'::text NOT NULL,
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    trial_imports integer,
    trial_tokens integer,
    trial_imports_used integer,
    trial_tokens_used integer,
    subscription_ends_at timestamp with time zone,
    subscription_status text DEFAULT 'active'::text,
    CONSTRAINT profiles_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'canceled'::text, 'expired'::text])))
);


--
-- Name: recipe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe (
    title character varying NOT NULL,
    description character varying,
    meal_type character varying,
    difficulty character varying,
    prep_time character varying,
    cook_time character varying,
    total_time character varying,
    servings character varying,
    nutrition_calories character varying,
    nutrition_protein character varying,
    nutrition_carbs character varying,
    nutrition_fat character varying,
    chef_notes character varying,
    source_platform character varying NOT NULL,
    source_url character varying NOT NULL,
    source_domain character varying,
    imported_at timestamp without time zone NOT NULL,
    media_video_url character varying,
    media_image_url character varying,
    media_local_path character varying,
    is_favorite boolean NOT NULL,
    id uuid NOT NULL
);


--
-- Name: recipe_collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: recipe_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid,
    name text NOT NULL,
    amount text,
    "position" integer
);


--
-- Name: recipe_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_likes (
    owner_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recipe_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid,
    step_number integer,
    text text NOT NULL
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    title text NOT NULL,
    description text,
    servings integer,
    notes text,
    nutrition_calories integer,
    nutrition_protein text,
    nutrition_carbs text,
    nutrition_fat text,
    source_url text,
    source_platform text,
    video_url text,
    image_url text,
    tags text[],
    is_imported boolean DEFAULT false,
    is_import_approved boolean DEFAULT false,
    raw_import_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    prep_time text,
    cook_time text,
    total_time text,
    meal_type text,
    difficulty text
);


--
-- Name: recipetag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipetag (
    name character varying NOT NULL,
    id uuid NOT NULL,
    recipe_id uuid NOT NULL
);


--
-- Name: shopping_list_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shopping_list_item (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    amount character varying,
    is_checked boolean NOT NULL,
    recipe_id character varying,
    recipe_name character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: shopping_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shopping_list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    recipe_id uuid,
    name text NOT NULL,
    amount text,
    is_checked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    request_id uuid,
    event_type text NOT NULL,
    source text,
    model_provider text,
    model_name text,
    tokens_input integer DEFAULT 0 NOT NULL,
    tokens_output integer DEFAULT 0 NOT NULL,
    tokens_total integer DEFAULT 0 NOT NULL,
    tokens_weighted integer DEFAULT 0 NOT NULL,
    ai_credits_used integer DEFAULT 0 NOT NULL,
    import_credits_used integer DEFAULT 0 NOT NULL,
    cost_usd double precision,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: usage_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_monthly (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    period_start date NOT NULL,
    import_count integer NOT NULL,
    ai_tokens integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: usersettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usersettings (
    user_id uuid NOT NULL,
    country character varying,
    unit_preference character varying NOT NULL,
    language_preference character varying NOT NULL,
    notifications_enabled boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: import_usage_monthly import_usage_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_usage_monthly
    ADD CONSTRAINT import_usage_monthly_pkey PRIMARY KEY (id);


--
-- Name: ingredient ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient
    ADD CONSTRAINT ingredient_pkey PRIMARY KEY (id);


--
-- Name: instructionstep instructionstep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructionstep
    ADD CONSTRAINT instructionstep_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: recipe_collection_items recipe_collection_items_collection_id_recipe_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_collection_items
    ADD CONSTRAINT recipe_collection_items_collection_id_recipe_id_key UNIQUE (collection_id, recipe_id);


--
-- Name: recipe_collection_items recipe_collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_collection_items
    ADD CONSTRAINT recipe_collection_items_pkey PRIMARY KEY (id);


--
-- Name: recipe_collections recipe_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_collections
    ADD CONSTRAINT recipe_collections_pkey PRIMARY KEY (id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: recipe_likes recipe_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_likes
    ADD CONSTRAINT recipe_likes_pkey PRIMARY KEY (owner_id, recipe_id);


--
-- Name: recipe recipe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe
    ADD CONSTRAINT recipe_pkey PRIMARY KEY (id);


--
-- Name: recipe_steps recipe_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: recipetag recipetag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipetag
    ADD CONSTRAINT recipetag_pkey PRIMARY KEY (id);


--
-- Name: shopping_list_item shopping_list_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_item
    ADD CONSTRAINT shopping_list_item_pkey PRIMARY KEY (id);


--
-- Name: shopping_list_items shopping_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_items
    ADD CONSTRAINT shopping_list_items_pkey PRIMARY KEY (id);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: usage_monthly usage_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_monthly
    ADD CONSTRAINT usage_monthly_pkey PRIMARY KEY (id);


--
-- Name: usersettings usersettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usersettings
    ADD CONSTRAINT usersettings_pkey PRIMARY KEY (user_id);


--
-- Name: idx_collection_items_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_items_collection ON public.recipe_collection_items USING btree (collection_id);


--
-- Name: idx_collection_items_recipe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_items_recipe ON public.recipe_collection_items USING btree (recipe_id);


--
-- Name: idx_recipe_collections_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_collections_owner ON public.recipe_collections USING btree (owner_id);


--
-- Name: idx_usage_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_created_at ON public.usage_events USING btree (created_at);


--
-- Name: idx_usage_events_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_owner ON public.usage_events USING btree (owner_id);


--
-- Name: idx_usage_events_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_request ON public.usage_events USING btree (request_id);


--
-- Name: idx_usage_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_type ON public.usage_events USING btree (event_type);


--
-- Name: ix_import_usage_monthly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_import_usage_monthly_id ON public.import_usage_monthly USING btree (id);


--
-- Name: ix_import_usage_monthly_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_import_usage_monthly_owner_id ON public.import_usage_monthly USING btree (owner_id);


--
-- Name: ix_import_usage_monthly_period_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_import_usage_monthly_period_start ON public.import_usage_monthly USING btree (period_start);


--
-- Name: ix_import_usage_monthly_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_import_usage_monthly_source ON public.import_usage_monthly USING btree (source);


--
-- Name: ix_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ingredient_id ON public.ingredient USING btree (id);


--
-- Name: ix_instructionstep_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_instructionstep_id ON public.instructionstep USING btree (id);


--
-- Name: ix_recipe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipe_id ON public.recipe USING btree (id);


--
-- Name: ix_recipetag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipetag_id ON public.recipetag USING btree (id);


--
-- Name: ix_shopping_list_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shopping_list_item_id ON public.shopping_list_item USING btree (id);


--
-- Name: ix_shopping_list_item_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shopping_list_item_user_id ON public.shopping_list_item USING btree (user_id);


--
-- Name: ix_usage_monthly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usage_monthly_id ON public.usage_monthly USING btree (id);


--
-- Name: ix_usage_monthly_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usage_monthly_owner_id ON public.usage_monthly USING btree (owner_id);


--
-- Name: ix_usage_monthly_period_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usage_monthly_period_start ON public.usage_monthly USING btree (period_start);


--
-- Name: ix_usersettings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usersettings_user_id ON public.usersettings USING btree (user_id);


--
-- Name: recipe_ingredients_recipe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_ingredients_recipe_id_idx ON public.recipe_ingredients USING btree (recipe_id);


--
-- Name: recipe_steps_recipe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_steps_recipe_id_idx ON public.recipe_steps USING btree (recipe_id);


--
-- Name: recipes_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipes_owner_id_idx ON public.recipes USING btree (owner_id);


--
-- Name: shopping_list_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shopping_list_owner_id_idx ON public.shopping_list_items USING btree (owner_id);


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: recipes set_recipes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: recipe_collection_items recipe_collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_collection_items
    ADD CONSTRAINT recipe_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.recipe_collections(id) ON DELETE CASCADE;


--
-- Name: recipe_collection_items recipe_collection_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_collection_items
    ADD CONSTRAINT recipe_collection_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_likes recipe_likes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_likes
    ADD CONSTRAINT recipe_likes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: recipe_likes recipe_likes_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_likes
    ADD CONSTRAINT recipe_likes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_steps recipe_steps_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: recipetag recipetag_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipetag
    ADD CONSTRAINT recipetag_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipe(id) ON DELETE CASCADE;


--
-- Name: shopping_list_items shopping_list_items_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_items
    ADD CONSTRAINT shopping_list_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: shopping_list_items shopping_list_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_items
    ADD CONSTRAINT shopping_list_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;


--
-- Name: recipe_ingredients Ingredients deletable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ingredients deletable by owner" ON public.recipe_ingredients FOR DELETE USING ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_ingredients Ingredients insertable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ingredients insertable by owner" ON public.recipe_ingredients FOR INSERT WITH CHECK ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_ingredients Ingredients readable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ingredients readable by owner" ON public.recipe_ingredients FOR SELECT USING ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_ingredients Ingredients updatable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ingredients updatable by owner" ON public.recipe_ingredients FOR UPDATE USING ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_likes Likes deletable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Likes deletable by owner" ON public.recipe_likes FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: recipe_likes Likes insertable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Likes insertable by owner" ON public.recipe_likes FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: recipe_likes Likes readable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Likes readable by owner" ON public.recipe_likes FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: profiles Profiles are insertable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are insertable by owner" ON public.profiles FOR INSERT WITH CHECK ((id = auth.uid()));


--
-- Name: profiles Profiles are readable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are readable by owner" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: profiles Profiles are updatable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are updatable by owner" ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- Name: recipes Recipes are deletable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipes are deletable by owner" ON public.recipes FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: recipes Recipes are insertable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipes are insertable by owner" ON public.recipes FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: recipes Recipes are readable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipes are readable by owner" ON public.recipes FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: recipes Recipes are updatable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipes are updatable by owner" ON public.recipes FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: shopping_list_items Shopping list deletable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shopping list deletable by owner" ON public.shopping_list_items FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: shopping_list_items Shopping list insertable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shopping list insertable by owner" ON public.shopping_list_items FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: shopping_list_items Shopping list readable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shopping list readable by owner" ON public.shopping_list_items FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: shopping_list_items Shopping list updatable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shopping list updatable by owner" ON public.shopping_list_items FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: recipe_steps Steps deletable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Steps deletable by owner" ON public.recipe_steps FOR DELETE USING ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_steps Steps insertable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Steps insertable by owner" ON public.recipe_steps FOR INSERT WITH CHECK ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_steps Steps readable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Steps readable by owner" ON public.recipe_steps FOR SELECT USING ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: recipe_steps Steps updatable by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Steps updatable by owner" ON public.recipe_steps FOR UPDATE USING ((recipe_id IN ( SELECT recipes.id
   FROM public.recipes
  WHERE (recipes.owner_id = auth.uid()))));


--
-- Name: import_usage_monthly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_usage_monthly ENABLE ROW LEVEL SECURITY;

--
-- Name: import_usage_monthly import_usage_monthly_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_usage_monthly_owner_read ON public.import_usage_monthly FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: import_usage_monthly import_usage_monthly_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_usage_monthly_owner_update ON public.import_usage_monthly FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: import_usage_monthly import_usage_monthly_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_usage_monthly_owner_write ON public.import_usage_monthly FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: shopping_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_monthly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_monthly ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_monthly usage_monthly_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usage_monthly_owner_read ON public.usage_monthly FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: usage_monthly usage_monthly_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usage_monthly_owner_update ON public.usage_monthly FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: usage_monthly usage_monthly_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usage_monthly_owner_write ON public.usage_monthly FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- PostgreSQL database dump complete
--

\unrestrict LaDEtQwzNmuTkqNTmZYks484j8bgc1U2RmOuVqha4feZujnd8yFZOIicyj2LM2B

