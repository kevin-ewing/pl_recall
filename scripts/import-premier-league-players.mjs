#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const API_ORIGIN = "https://sdp-prem-prod.premier-league-prod.pulselive.com";
const COMPETITION_ID = "8";
// The legacy public PL path serves a 500×500 image despite its `250x250`
// path segment. The current-directory path is used only when no 500px image
// is available for that player.
const HIGH_RES_PHOTO_ORIGIN = "https://resources.premierleague.com/premierleague/photos/players/250x250";
const STANDARD_RES_PHOTO_ORIGIN = "https://resources.premierleague.com/premierleague25/photos/players/110x140";
const ASSET_ORIGIN = "https://resources.premierleague.com/premierleague25";
const PAGE_SIZE = 100;
const PHOTO_CONCURRENCY = 8;
const PLAYER_NAME_BATCH_SIZE = 100;

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const season = option("--season", "2026");
const outputPath = resolve(option("--out", `data/premier-league-players-${season}.json`));
const assetsPath = resolve(option("--assets-out", "web/public/assets"));

function flagFileName(countryCode) {
  return countryCode.toLowerCase().replaceAll(/[^a-z0-9-]/g, "-");
}

async function getPage(cursor) {
  const url = new URL(
    `/api/v1/competitions/${COMPETITION_ID}/seasons/${season}/players`,
    API_ORIGIN,
  );
  url.searchParams.set("_limit", String(PAGE_SIZE));
  if (cursor) url.searchParams.set("_next", cursor);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Premier League API returned ${response.status} for ${url}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.data) || !payload.pagination) {
    throw new Error("Unexpected Premier League player-list response.");
  }
  return payload;
}

const sourcePlayers = [];
let cursor;
do {
  const page = await getPage(cursor);
  sourcePlayers.push(...page.data);
  cursor = page.pagination._next;
  console.log(`Fetched ${sourcePlayers.length} players…`);
} while (cursor);

const ids = new Set();
const candidates = sourcePlayers.map((player) => {
  const playerId = player.id?.playerId;
  if (!playerId || ids.has(playerId)) {
    throw new Error(`Missing or duplicate player ID: ${playerId ?? "unknown"}`);
  }
  ids.add(playerId);

  const firstName = player.name?.firstName ?? "";
  const lastName = player.name?.lastName ?? "";
  return {
    id: playerId,
    name: [firstName, lastName].filter(Boolean).join(" "),
    firstName,
    lastName,
    club: player.currentTeam?.name ?? null,
    clubId: player.currentTeam?.id ?? null,
    clubBadgeUrl: player.currentTeam?.id ? `/assets/clubs/${player.currentTeam.id}.svg` : null,
    position: player.position ?? null,
    shirtNumber: player.shirtNum ?? null,
    countryCode: player.country?.isoCode ?? null,
    country: player.country?.country ?? null,
    nationality: player.country?.demonym ?? null,
    flagUrl: player.country?.isoCode
      ? `/assets/flags/${flagFileName(player.country.isoCode)}.svg`
      : "/assets/flags/globe.svg",
    highResPhotoUrl: `${HIGH_RES_PHOTO_ORIGIN}/p${playerId}.png`,
    standardResPhotoUrl: `${STANDARD_RES_PHOTO_ORIGIN}/${playerId}.png`,
  };
});

async function getDisplayNames(playerIds) {
  const names = new Map();
  for (let index = 0; index < playerIds.length; index += PLAYER_NAME_BATCH_SIZE) {
    const idsForBatch = playerIds.slice(index, index + PLAYER_NAME_BATCH_SIZE);
    const url = new URL("/api/v2/players-by-id", API_ORIGIN);
    url.searchParams.set("id", idsForBatch.join(","));
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Premier League display-name API returned ${response.status}.`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Unexpected Premier League display-name response.");
    for (const player of batch) {
      const displayName = player.knownName || player.name;
      if (player.id && displayName) names.set(String(player.id), displayName);
    }
  }
  return names;
}

const displayNames = await getDisplayNames(candidates.map((player) => player.id));
const namedCandidates = candidates.map((player) => {
  const registeredName = player.name;
  const displayName = displayNames.get(player.id) || registeredName;
  return { ...player, name: displayName, displayName, registeredName };
});
console.log(`Added official display names for ${displayNames.size} players.`);

async function hasOfficialPhoto(url) {
  try {
    // The directory uses the same request and falls back to its generic image
    // when this URL does not return a PNG. Do not include those fallback cards.
    const response = await fetch(url, {
      headers: { Accept: "image/png" },
    });
    const isPhoto = response.ok && response.headers.get("content-type") === "image/png";
    await response.body?.cancel();
    return isPhoto;
  } catch {
    return false;
  }
}

async function keepPlayersWithPhotos(players) {
  const resolved = new Array(players.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < players.length) {
      const index = nextIndex++;
      const player = players[index];
      if (await hasOfficialPhoto(player.highResPhotoUrl)) {
        const { highResPhotoUrl, standardResPhotoUrl, ...details } = player;
        resolved[index] = {
          ...details,
          photoUrl: highResPhotoUrl,
          photoWidth: 500,
          photoHeight: 500,
        };
      } else if (await hasOfficialPhoto(player.standardResPhotoUrl)) {
        const { highResPhotoUrl, standardResPhotoUrl, ...details } = player;
        resolved[index] = {
          ...details,
          photoUrl: standardResPhotoUrl,
          photoWidth: 110,
          photoHeight: 140,
        };
      }
      if ((index + 1) % 100 === 0) {
        console.log(`Checked ${index + 1} player photos…`);
      }
    }
  }

  await Promise.all(Array.from({ length: PHOTO_CONCURRENCY }, worker));
  return resolved.filter(Boolean);
}

const players = await keepPlayersWithPhotos(namedCandidates);

async function downloadSvg(url, filePath) {
  try {
    const response = await fetch(url, { headers: { Accept: "image/svg+xml" } });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("svg")) return false;
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function runWithConcurrency(items, callback, concurrency = PHOTO_CONCURRENCY) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await callback(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

async function syncIdentityAssets(cards) {
  const clubDirectory = join(assetsPath, "clubs");
  const flagDirectory = join(assetsPath, "flags");
  await Promise.all([mkdir(clubDirectory, { recursive: true }), mkdir(flagDirectory, { recursive: true })]);

  const clubIds = [...new Set(cards.map((player) => player.clubId).filter(Boolean))];
  const countryCodes = [...new Set(cards.map((player) => player.countryCode).filter(Boolean))];
  const assets = [
    ...clubIds.map((clubId) => ({
      type: "club",
      url: `${ASSET_ORIGIN}/badges/${clubId}.svg`,
      path: join(clubDirectory, `${clubId}.svg`),
    })),
    ...countryCodes.map((countryCode) => ({
      type: "flag",
      url: `${ASSET_ORIGIN}/flags/${flagFileName(countryCode)}.svg`,
      path: join(flagDirectory, `${flagFileName(countryCode)}.svg`),
    })),
    {
      type: "flag",
      url: `${ASSET_ORIGIN}/flags/globe.svg`,
      path: join(flagDirectory, "globe.svg"),
    },
  ];

  let downloaded = 0;
  let unavailable = 0;
  await runWithConcurrency(assets, async (asset) => {
    if (await downloadSvg(asset.url, asset.path)) downloaded += 1;
    else unavailable += 1;
  });
  console.log(`Saved ${downloaded} club-badge and nationality-flag SVGs${unavailable ? ` (${unavailable} unavailable)` : ""}.`);

  return { downloaded, unavailable };
}

const syncedAssets = await syncIdentityAssets(players);

const dataset = {
  source: "Premier League public player directory API",
  sourceUrl: `https://www.premierleague.com/en/players?competition=${COMPETITION_ID}&season=${season}`,
  collectedAt: new Date().toISOString(),
  competitionId: COMPETITION_ID,
  season,
  sourcePlayerCount: candidates.length,
  excludedNoPhotoCount: candidates.length - players.length,
  highResolutionPhotoCount: players.filter((player) => player.photoWidth === 500).length,
  standardResolutionPhotoCount: players.filter((player) => player.photoWidth === 110).length,
  localAssetCount: syncedAssets.downloaded,
  unavailableAssetCount: syncedAssets.unavailable,
  count: players.length,
  players,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`Saved ${players.length} players to ${outputPath}`);
