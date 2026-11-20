// Entry program for the GTA 6 meme bounty (gta6-meme-x-01).
//
// Job: hand the house the address of the X post that is this entry.
// It reads POST.json from the repository, checks that it really is a
// single X post address, and copies its exact bytes into the output
// directory as POST.json. Nothing else is written, nothing is fetched,
// and a successful run prints nothing.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The house caps the post file at 16 KiB; anything bigger is invalid.
const MAX_POST_BYTES = 16384;

// An X post address: x.com or twitter.com, optional www./mobile. prefix,
// a handle, then /status/<digits> (or the /i/web/status/<digits> form).
const POST_ADDRESS =
  /^https:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/(?:i\/web\/status\/\d+|[^/\s]+\/status\/\d+)$/;

function abort(reason: string): never {
  process.stderr.write(`main.ts: ${reason}\n`);
  process.exit(1);
}

function directoryFrom(variable: string, fallback: string): string {
  const raw = process.env[variable];
  const chosen = raw === undefined || raw.trim() === "" ? fallback : raw;
  return resolve(chosen);
}

const repoRoot = directoryFrom("MAKEFUN_BOT_DIR", ".");
const outputRoot = directoryFrom("MAKEFUN_OUTPUT_DIR", "out");

const postPath = join(repoRoot, "POST.json");
if (!existsSync(postPath)) {
  abort(`POST.json not found in ${repoRoot}`);
}

let rawPost: Buffer;
try {
  rawPost = readFileSync(postPath);
} catch (error) {
  abort(
    `could not read POST.json: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (rawPost.length === 0) {
  abort("POST.json is empty");
}

if (rawPost.length > MAX_POST_BYTES) {
  abort(`POST.json is ${rawPost.length} bytes, over the ${MAX_POST_BYTES} byte limit`);
}

let parsed: unknown;
try {
  parsed = JSON.parse(rawPost.toString("utf8"));
} catch {
  abort("POST.json is not valid JSON");
}

if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
  abort("POST.json must be a JSON object with a url field");
}

function addressProblem(address: unknown): string | null {
  if (typeof address !== "string" || address === "") {
    return "POST.json url is missing or empty";
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(address);
  } catch {
    return `POST.json url is not a valid URL: ${address}`;
  }
  if (parsedUrl.protocol !== "https:") {
    return "POST.json url must use https";
  }
  const host = parsedUrl.hostname.replace(/^(www\.|mobile\.)/, "");
  if (host !== "x.com" && host !== "twitter.com") {
    return "POST.json url must point at x.com or twitter.com";
  }
  if (!POST_ADDRESS.test(address)) {
    return "POST.json url must look like https://x.com/<handle>/status/<digits>";
  }
  return null;
}

const address = (parsed as Record<string, unknown>).url;
const problem = addressProblem(address);
if (problem !== null) {
  abort(problem);
}

try {
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "POST.json"), rawPost);
} catch (error) {
  abort(
    `could not write POST.json to ${outputRoot}: ${error instanceof Error ? error.message : String(error)}`,
  );
}
