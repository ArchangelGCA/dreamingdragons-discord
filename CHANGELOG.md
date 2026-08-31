# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] – 2026-08-31

### Added

- `CHANGELOG.md` (this file), following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, plus a pointer to it in the README.

### Fixed

- **Web / Shop:** the preview card's XP bar shimmer now has a smooth ending — the highlight sweep is sized to the whole bar and fully exits before the animation loops, instead of abruptly vanishing mid-sweep at the end of every cycle (it was previously sized to the bar's fill, so a partially visible highlight teleported back to the start).

## [0.1.3] – 2026-08-31

### Changed

- Removed excessive text from the shop page.
- The shop's live preview card now scrolls with the user so it is always visible (desktop only).
- Internal frontend changes.

## [0.1.2] – 2026-08-25

### Changed

- Centralised shop configuration — the cosmetics catalog has a single source of truth (`shared/cosmetics.json`) consumed by both the bot and the dashboard.
- Internal changes.

## [0.1.1] – 2026-08-25

### Fixed

- `/shop` command now features pagination.

## [0.1.0] – 2026-08-24

### Added

- New cosmetics and enhancements to the shop and daily rewards.
- Experimental Bun 1.4 migration (Bun replaces Node/npm for running, testing and deployment).
- Everything between v0.0.3 and this release, including the full bot rework: new libraries and commands, an admin-only SvelteKit dashboard, a public website, and easy Docker Compose deployment (shipped 2026-08-20…2026-08-21 without a version bump).

## [0.0.3] – 2025-11-25

### Changed

- Improved handling for failing Discord logins and PocketBase connection issues.
- Upgraded packages.

### Removed

- DeviantArt feed reader and its commands.

## [0.0.2] – 2025-04-20

### Changed

- MIT license declared in `package.json`.
- Caching and refresh issues with `pocketbase.js` — attempted fixes.

## [0.0.1] – 2025-04-08

### Added

- Initial release.

[Unreleased]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/ArchangelGCA/dreamingdragons-discord/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ArchangelGCA/dreamingdragons-discord/releases/tag/v0.0.1
