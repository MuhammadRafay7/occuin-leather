BEGIN;

CREATE TYPE public.bespoke_status AS ENUM ('question','new','quoted','changes_requested','accepted','declined','in_production','completed');

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_email text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    detail text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.bespoke_designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_key text NOT NULL,
    name text NOT NULL,
    design jsonb NOT NULL,
    share_token_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.bespoke_logos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_key text NOT NULL,
    filename text NOT NULL,
    rights_confirmed_at timestamp with time zone NOT NULL,
    png bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.bespoke_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    author text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bespoke_message_author CHECK ((author = ANY (ARRAY['customer'::text, 'team'::text])))
);
CREATE TABLE public.bespoke_request_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    "position" integer NOT NULL,
    content_type text NOT NULL,
    filename text NOT NULL,
    byte_size integer NOT NULL,
    bytes bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bespoke_image_size CHECK (((byte_size >= 1) AND (byte_size <= 4194304)))
);
CREATE TABLE public.bespoke_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number integer NOT NULL,
    status public.bespoke_status DEFAULT 'new'::public.bespoke_status NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    country text NOT NULL,
    phone text,
    product_type text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    design jsonb NOT NULL,
    estimate_low_cents integer NOT NULL,
    estimate_high_cents integer NOT NULL,
    quoted_price_cents integer,
    admin_note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_key text,
    accepted_owner_key text,
    order_id uuid,
    quoted_at timestamp with time zone,
    quote_expires_at timestamp with time zone,
    quote_emailed_at timestamp with time zone,
    accepted_at timestamp with time zone,
    change_message text,
    change_requested_at timestamp with time zone,
    deposit_percent integer DEFAULT 50 NOT NULL,
    deposit_paid_at timestamp with time zone,
    balance_requested_at timestamp with time zone,
    balance_paid_at timestamp with time zone,
    balance_order_id uuid,
    CONSTRAINT bespoke_deposit_percent CHECK (((deposit_percent >= 1) AND (deposit_percent <= 100))),
    CONSTRAINT bespoke_estimate_order CHECK (((estimate_low_cents > 0) AND (estimate_high_cents >= estimate_low_cents))),
    CONSTRAINT bespoke_quote_positive CHECK (((quoted_price_cents IS NULL) OR (quoted_price_cents > 0)))
);
CREATE SEQUENCE public.bespoke_requests_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.bespoke_requests_number_seq OWNED BY public.bespoke_requests.number;
CREATE TABLE public.bespoke_tokens (
    token_hash text NOT NULL,
    request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '90 days'::interval) NOT NULL
);
CREATE TABLE public.media_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    content_type text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    byte_size integer NOT NULL,
    bytes bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.order_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    reason text NOT NULL,
    stripe_refund_id text,
    actor_email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_refunds_positive CHECK ((amount_cents > 0))
);
CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id uuid NOT NULL,
    delta integer NOT NULL,
    stock_after integer NOT NULL,
    reason text NOT NULL,
    actor_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.bespoke_requests ALTER COLUMN number SET DEFAULT nextval('public.bespoke_requests_number_seq'::regclass);
ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bespoke_designs
    ADD CONSTRAINT bespoke_designs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bespoke_designs
    ADD CONSTRAINT bespoke_designs_share_token_hash_unique UNIQUE (share_token_hash);
ALTER TABLE ONLY public.bespoke_logos
    ADD CONSTRAINT bespoke_logos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bespoke_messages
    ADD CONSTRAINT bespoke_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bespoke_request_images
    ADD CONSTRAINT bespoke_request_images_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bespoke_requests
    ADD CONSTRAINT bespoke_requests_number_unique UNIQUE (number);
ALTER TABLE ONLY public.bespoke_requests
    ADD CONSTRAINT bespoke_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bespoke_tokens
    ADD CONSTRAINT bespoke_tokens_pkey PRIMARY KEY (token_hash);
ALTER TABLE ONLY public.media_images
    ADD CONSTRAINT media_images_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_refunds
    ADD CONSTRAINT order_refunds_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);
CREATE INDEX admin_audit_created_idx ON public.admin_audit_log USING btree (created_at);
CREATE INDEX admin_audit_target_idx ON public.admin_audit_log USING btree (target_type, target_id);
CREATE INDEX bespoke_designs_owner_idx ON public.bespoke_designs USING btree (owner_key);
CREATE UNIQUE INDEX bespoke_image_position ON public.bespoke_request_images USING btree (request_id, "position");
CREATE INDEX bespoke_logos_owner_idx ON public.bespoke_logos USING btree (owner_key);
CREATE INDEX bespoke_messages_request_idx ON public.bespoke_messages USING btree (request_id);
CREATE INDEX bespoke_requests_owner_idx ON public.bespoke_requests USING btree (owner_key);
CREATE INDEX bespoke_requests_status_idx ON public.bespoke_requests USING btree (status);
CREATE INDEX bespoke_tokens_request_idx ON public.bespoke_tokens USING btree (request_id);
CREATE INDEX order_refunds_order_idx ON public.order_refunds USING btree (order_id);
CREATE INDEX stock_movements_variant_idx ON public.stock_movements USING btree (variant_id, created_at);
ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.bespoke_messages
    ADD CONSTRAINT bespoke_messages_request_id_bespoke_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.bespoke_requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bespoke_request_images
    ADD CONSTRAINT bespoke_request_images_request_id_bespoke_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.bespoke_requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bespoke_requests
    ADD CONSTRAINT bespoke_requests_balance_order_id_orders_id_fk FOREIGN KEY (balance_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.bespoke_requests
    ADD CONSTRAINT bespoke_requests_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.bespoke_tokens
    ADD CONSTRAINT bespoke_tokens_request_id_bespoke_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.bespoke_requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_refunds
    ADD CONSTRAINT order_refunds_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_variant_id_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE CASCADE;

ALTER TABLE public.cart_items ADD COLUMN bespoke_request_id uuid, ADD COLUMN bespoke_part text;
ALTER TABLE public.order_items ADD COLUMN bespoke_request_id uuid, ADD COLUMN bespoke_part text;
ALTER TABLE public.promo_codes ADD COLUMN max_uses integer, ADD COLUMN once_per_customer boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN blocked_at timestamp with time zone, ADD COLUMN admin_note text NOT NULL DEFAULT '';
ALTER TABLE public.reviews ADD COLUMN hidden_at timestamp with time zone, ADD COLUMN reply text, ADD COLUMN replied_at timestamp with time zone;
ALTER TABLE public.contact_messages ADD COLUMN reply text, ADD COLUMN replied_at timestamp with time zone;
ALTER TABLE public.cart_items DROP CONSTRAINT cart_items_one_target;
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_one_target CHECK (num_nonnulls(variant_id, design_id, bespoke_request_id) = 1);
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_bespoke_request_id_bespoke_requests_id_fk FOREIGN KEY (bespoke_request_id) REFERENCES public.bespoke_requests(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_bespoke_request_id_bespoke_requests_id_fk FOREIGN KEY (bespoke_request_id) REFERENCES public.bespoke_requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX cart_items_bespoke_unique ON public.cart_items USING btree (cart_id, bespoke_request_id, bespoke_part);

CREATE TABLE public.site_content (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT site_content_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS making_days integer;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_snapshot jsonb, ADD COLUMN IF NOT EXISTS bespoke_snapshot jsonb, ADD COLUMN IF NOT EXISTS sent_to_maker_at timestamp with time zone, ADD COLUMN IF NOT EXISTS sent_to_maker_by text;

CREATE TABLE IF NOT EXISTS public.order_item_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_item_id uuid NOT NULL,
    kind text NOT NULL,
    slot text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    content_type text NOT NULL,
    width integer,
    height integer,
    byte_size integer NOT NULL,
    bytes bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_item_files_order_item_id_order_items_id_fk FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE,
    CONSTRAINT order_item_files_kind CHECK (kind IN ('view', 'photo', 'logo', 'reference')),
    CONSTRAINT order_item_files_size CHECK (byte_size BETWEEN 1 AND 4194304)
);
CREATE UNIQUE INDEX IF NOT EXISTS order_item_files_slot ON public.order_item_files USING btree (order_item_id, kind, slot);

CREATE TABLE IF NOT EXISTS public.manufacturer_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL,
    include_address boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_by text NOT NULL,
    last_opened_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manufacturer_links_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS manufacturer_links_order_idx ON public.manufacturer_links USING btree (order_id);

COMMIT;
