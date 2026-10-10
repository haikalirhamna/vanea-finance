# Vanea — Build and release

## Build

```sh
npm install
npm run typecheck && npm run lint && npm test

# Development build for a phone or emulator (keeps INTERNET so Metro can connect)
npx eas build --profile development --platform android

# Release build: VANEA_RELEASE=1 removes the INTERNET permission (set in eas.json)
npx eas build --profile production --platform android      # .aab for Play
npx eas build --profile preview --platform android         # .apk to install and test
```

Check the built manifest: the release APK/AAB must not contain `android.permission.INTERNET`
(`aapt dump permissions app.apk`).

## Check on a real device before trusting a release

These could not be verified in the development container (no device or emulator):

1. **Encryption:** the database file is not readable as plain SQLite; reopening with the wrong key fails; the app survives a restart.
2. **Keystore key:** data stays readable after a restart and after the phone reboots.
3. **Backup:** export shows the share sheet; the file restores on a fresh install; a wrong passphrase gives the explained error.
4. **Backup speed:** scrypt (N = 2^15) finishes in a few seconds on a mid-range phone. If not, lower `N` in `src/data/backup-crypto.ts` (existing backups keep their stored parameters).
5. **Notifications:** payday, bill, subscription, monthly and backup reminders fire at 09:00; permission is requested once.
6. **App lock:** prompts on open and after 60 s in the background; turning it off needs authentication.
7. **TalkBack:** every control has a label; font scale 200% does not clip amounts.
8. **Dark mode:** every screen is readable.

## Versioning

`app.config.js` holds `version` and `android.versionCode`; increase `versionCode` for every upload.
