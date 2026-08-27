.PHONY: sync

SYNC_SEASON ?= 2026

sync:
	node scripts/import-premier-league-players.mjs --season $(SYNC_SEASON) --out web/public/data/premier-league-players-$(SYNC_SEASON).json --assets-out web/public/assets
