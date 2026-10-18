import type { HogayaRequest, Provider } from "@/lib/types";

export interface ConsoleConfig {
  agentMode: string;
  dryRun?: boolean;
  realSteps: { provider: boolean; customer: boolean; booking: boolean; reconfirm: boolean; arrival: boolean; on_the_way: boolean };
}

export interface ConsoleData {
  requests: HogayaRequest[];
  providers: Provider[];
  config: ConsoleConfig;
}

export interface ConsoleSettings {
  simulate_no_reconfirm: boolean;
  autopilot: boolean;
}
