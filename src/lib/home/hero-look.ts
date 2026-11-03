import { withInitials } from "../studio/initials";
import { PRESETS, type PresetKey } from "../studio/presets";
import { normalizeSpec, type ColorKey, type DesignSpec, type FinishKey, type Hide } from "../studio/spec";

export type HeroForm = { key: PresetKey; label: string; slug: string };
export type HeroLook = { finish?: FinishKey; thread?: DesignSpec["stitch"]["thread"]; metal?: DesignSpec["hardware"]["metal"]; initials?: string };

export function lookSpec(key: PresetKey, color: ColorKey, look: HeroLook): DesignSpec {
  const base = PRESETS[key];
  const paint = (hide: Hide): Hide => ({ finish: look.finish ?? hide.finish, color });
  const spec: DesignSpec = {
    ...base,
    panels: { ...base.panels, primary: paint(base.panels.primary), gusset: paint(base.panels.gusset) },
    stitch: look.thread ? { ...base.stitch, thread: look.thread } : base.stitch,
    hardware: look.metal ? { ...base.hardware, metal: look.metal } : base.hardware,
  };
  return normalizeSpec(look.initials ? withInitials(spec, look.initials) : spec);
}

export function lookHref(form: HeroForm, color: ColorKey, look: HeroLook) {
  const params = new URLSearchParams({ from: form.slug, color });
  if (look.finish) params.set("finish", look.finish);
  if (look.thread) params.set("thread", look.thread);
  if (look.metal) params.set("metal", look.metal);
  if (look.initials) params.set("initials", look.initials);
  return `/studio?${params.toString()}`;
}
