import type { DesignSpec } from "./spec";

type Linked = { name: string; studioPreset: DesignSpec | null };

export const studioModelOf = ({ name, studioPreset }: Linked): DesignSpec | null => (studioPreset?.name === name ? studioPreset : null);
