import {
  BatteryCharging, Flame, GlassWater, Hammer, Refrigerator, Snowflake, WashingMachine, Waves, Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Category } from "./categories";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  electrician: Zap,
  plumber: Wrench,
  ac: Snowflake,
  pump: Waves,
  washing_machine: WashingMachine,
  ro: GlassWater,
  fridge: Refrigerator,
  geyser: Flame,
  inverter: BatteryCharging,
  carpenter: Hammer,
};
