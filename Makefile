.PHONY: help install dev lint typecheck sync build build-pages check

WEB_DIR := web
SYNC_SEASON ?= 2026
PAGES_BASE_PATH ?= /pl_recall

help:
	@printf '%s\n' \
	  'make install      Install the locked web dependencies' \
	  'make dev          Start the local development server' \
	  'make sync         Refresh the official player data and SVG assets' \
	  'make lint         Run ESLint' \
	  'make typecheck    Run TypeScript checks' \
	  'make build        Build a static site for a root-hosted server' \
	  'make build-pages  Build the GitHub Pages artifact' \
	  'make check        Run lint, typecheck, and a static build'

install:
	npm --prefix $(WEB_DIR) ci

dev:
	npm --prefix $(WEB_DIR) run dev

lint:
	npm --prefix $(WEB_DIR) run lint

typecheck:
	npm --prefix $(WEB_DIR) run typecheck

sync:
	node scripts/import-premier-league-players.mjs --season $(SYNC_SEASON) --out web/public/data/premier-league-players-$(SYNC_SEASON).json --assets-out web/public/assets

build:
	node scripts/build-static.mjs

build-pages:
	node scripts/build-static.mjs --base-path $(PAGES_BASE_PATH)

check: lint typecheck build
