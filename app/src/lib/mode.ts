/** "demo" (default) or "real". Real mode places real Fo calls for live categories only. */
export const MODE = process.env.AGENT_MODE ?? "demo";
/** Rehearsal: the live flow runs exactly as in real mode, but no Fo call is ever made (the calls are faked). For testing only. */
export const DRY_RUN = process.env.FO_DRY_RUN === "1";
/** The language Fo speaks on calls: "english" (default) or "hinglish". */
export const CALL_LANGUAGE: "english" | "hinglish" = (process.env.CALL_LANGUAGE ?? "english").trim().toLowerCase() === "hinglish" ? "hinglish" : "english";
