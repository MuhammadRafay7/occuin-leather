BEGIN;

UPDATE public.products
SET studio_preset = NULL
WHERE slug IN ('slate-buckle-satchel', 'tooled-bifold-wallet')
  AND studio_preset IS NOT NULL;

UPDATE public.site_content
SET value = jsonb_set(
      value,
      '{hero,forms}',
      jsonb_build_array(jsonb_build_object('key', 'laptop', 'label', 'Laptop', 'slug', 'bureau-15')) || (value #> '{hero,forms}')
    ),
    updated_at = now()
WHERE key = 'home'
  AND jsonb_typeof(value #> '{hero,forms}') = 'array'
  AND jsonb_array_length(value #> '{hero,forms}') < 5
  AND NOT (value #> '{hero,forms}') @> '[{"key": "laptop"}]'::jsonb;

UPDATE public.site_content
SET value = jsonb_set(
      jsonb_set(value, '{hero,fallbackImage}', '"/images/studio/crossbody.webp"'),
      '{hero,fallbackAlt}',
      '"A tan leather saddle bag with a shoulder strap"'
    ),
    updated_at = now()
WHERE key = 'home'
  AND value #>> '{hero,fallbackImage}' IN ('/images/hero/tote-cognac.webp', '/images/studio/laptop.webp');

COMMIT;
