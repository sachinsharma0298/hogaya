import path from "node:path";

/**
 * Where the local data files live (bookings, accounts, the Fo sign-in). It is OUTSIDE the app folder on purpose:
 * the dev server rebuilds the page whenever a file inside the app folder changes, so data kept there made every
 * save reload the browser. The folder is git-ignored. Override with HOGAYA_DATA_DIR.
 */
export const DATA_DIR = process.env.HOGAYA_DATA_DIR ?? path.join(process.cwd(), "..", "data");
