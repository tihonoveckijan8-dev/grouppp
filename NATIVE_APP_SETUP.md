# BandPlan native app shell

BandPlan remains a web/PWA app. Capacitor is prepared for Android and iOS so the native launch screen can be controlled separately from the launcher icon.

## Target launch sequence

1. User taps the normal BandPlan launcher icon.
2. Native launch screen shows only the dark BandPlan background (`#14161C`).
3. No launcher/app icon is displayed on the native launch screen.
4. WebView starts BandPlan.
5. The existing BandPlan BP animation runs.
6. The main application appears.

## Generate native projects

After installing dependencies on a machine with Android Studio/Xcode:

    npm install
    npx cap add android
    npx cap add ios
    npm run cap:sync

Then configure the generated native launch-screen resources so the launch background is `#14161C` and does not use the launcher icon as foreground artwork.

Open projects with:

    npm run cap:android
    npm run cap:ios

## Important

Do not remove or replace the PWA manifest icons. Those icons are still required for the installed PWA and the launcher icon.

The native launch screen and launcher icon are intentionally separate assets/configuration.