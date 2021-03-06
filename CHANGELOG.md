# Change Log
All notable changes to this project will be documented in this file.

## 1.2.0 - 2017-05-06
### Fixed
* Completely rewritten `vdf` file parser (both mine and [shortcuts.vdf](https://github.com/tirish/steam-shortcut-editor)) solves #2 and should solve #6 (not confirmed yet)
* Fixed #7 

### Added
* Generated entries can now be removed
* All added entries can be removed (which are added since this release)
* New image provider - `retrogaming.cloud`

### Changed
* `Glob-regex` now supports `leftovers`, thus allowing `${regex}.ext`. It will now remove `.ext` and pass remaining string to regex parser.
* `Glob` and `Glob-regex` now properly replace `${title}` and `${regex}` with star (`*`). Earlier `dir\*\${title}.ext` would become `dir\*\*`. Not it will be replaced like this - `dir\*\*.ext`. This will eliminate a lot of "failed matches" messages and should increase `node-glob` performance.
* All image providers now have 40 seconds timeout and 3 retries. This should address #3 

## 1.1.4 - 2017-05-02
### Fixed
* `shortcuts.vdf` should now have recurring titles removed as intended. If you had titles disappear, it was because Steam changed `AppName` property to `appname`. That resulted in too many titles and Steam got confused. Simply re-adding all titles via SRM should fix it as it will delete duplicates.

## 1.1.3 - 2017-05-01
### Added
* Greedy search option which will search for images using both `${title}` and `${fuzzyTitle}`

### Fixed
* Added a temporary fix, which should prevent `shortcuts.vdf` corruption

## 1.1.2 - 2017-05-01
### Added
* Additional one time backups will be made with extension `.firstbackup`

### Changed
* Glob-regex now joins capture pairs. See [here](https://regex101.com/r/xasqq9/2) how it can be used

### Fixed
* Alert component now times out as intended (previously it would just stay there until user clicked it or it received a new message to display)

## 1.1.1 - 2017-05-01
### Changed
- You won't be forced to shut down Steam anymore, but will be adviced to, everytime you generate a list

## 1.1.0 - 2017-05-01
### Added
- Offline mode

### Changed
- In order to release binaries for multiple platforms, Steam check is done only on Windows
- User data is now located at: `%APPDATA%\steam-rom-manager\userData` (Windows) or `~/.config/steam-rom-manager/userData` (linux)

## 1.0.0 - 2017-04-30
### Added
- Everything
