// The app's server talks to Fo's MCP endpoint itself.
// Sign-in is MCP OAuth: one browser sign-in by the operator, then the tokens are kept in the database (table fo_oauth).
// That table has row-level security with no policy and no browser privileges: the tokens never reach a browser.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth, UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { readFoAuth, writeFoAuth } from "./store";


const FO_URL = "https://mcp.api.wajo.ai/fo";
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

interface Saved {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  authUrl?: string;
}

const read = async () => (await readFoAuth()) as Saved;
const write = (patch: Partial<Saved>) => writeFoAuth(patch as Record<string, unknown>);

class FileAuthProvider implements OAuthClientProvider {
  get redirectUrl() {
    return `${APP_URL}/api/fo/callback`;
  }
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Hogaya",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }
  clientInformation = async () => (await read()).clientInformation;
  saveClientInformation = (c: OAuthClientInformationMixed) => write({ clientInformation: c });
  tokens = async () => (await read()).tokens;
  saveTokens = (t: OAuthTokens) => write({ tokens: t });
  saveCodeVerifier = (v: string) => write({ codeVerifier: v });
  codeVerifier = async () => {
    const v = (await read()).codeVerifier;
    if (!v) throw new Error("No code verifier saved");
    return v;
  };
  redirectToAuthorization = (url: URL) => write({ authUrl: url.toString() });
}

export const isSignedIn = async () => Boolean((await read()).tokens?.access_token);

function make() {
  const provider = new FileAuthProvider();
  const transport = new StreamableHTTPClientTransport(new URL(FO_URL), { authProvider: provider });
  const client = new Client({ name: "hogaya", version: "0.1.0" });
  return { provider, transport, client };
}

/** Start sign-in. Returns the Wajo sign-in URL to open in the browser, or null if already signed in. */
export async function startAuth(): Promise<string | null> {
  await write({ authUrl: undefined });
  const { client, transport, provider } = make();
  // Never trust "no error" alone: with no saved tokens we are NOT signed in, so start the sign-in.
  if (!(await isSignedIn())) {
    if ((await auth(provider, { serverUrl: FO_URL })) === "REDIRECT") return (await read()).authUrl ?? null;
  }
  try {
    await client.connect(transport);
    await client.callTool({ name: "list_fo_conversations", arguments: {} }); // read-only; Fo only asks for sign-in on a real tool call
    await client.close();
    return null;
  } catch (e) {
    if (e instanceof UnauthorizedError) return (await read()).authUrl ?? null;
    throw e;
  }
}

/** Finish sign-in with the code Wajo sent back to our callback. */
export async function finishAuth(code: string) {
  const { transport } = make();
  await transport.finishAuth(code);
}

export interface FoReply {
  status: "complete" | "working" | "failed";
  conversationId?: string;
  response?: string;
  progress?: string;
  elapsedSeconds?: number;
}

async function call<T = FoReply>(name: string, args: Record<string, unknown>): Promise<T> {
  const { client, transport } = make();
  await client.connect(transport);
  try {
    const res = await client.callTool({ name, arguments: args });
    if (res.isError) throw new Error(JSON.stringify(res.content).slice(0, 300));
    if (res.structuredContent) return res.structuredContent as unknown as T;
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    return JSON.parse(text) as T;
  } finally {
    await client.close();
  }
}

export const askFo = (message: string, opts: { newConversation?: boolean; conversationId?: string } = {}) =>
  call("ask_fo", { message, ...opts });
export const listFoConversations = () => call<Record<string, unknown>>("list_fo_conversations", {});
export const getFoReply = (conversationId: string, waitSeconds = 40) => call("get_fo_reply", { conversationId, waitSeconds });

export interface FoTurn {
  role: string;
  text: string;
  at?: string;
}
/** The last ~40 text turns of a conversation, oldest first. Fo posts its call summary here when the call ends. */
export const getFoConversation = (conversationId: string) =>
  call<{ turns: FoTurn[] }>("get_fo_conversation", { conversationId });
