# iOS startup-image media queries

The generator creates matching light/dark PNGs for:
- iPhone SE (2nd/3rd gen): 750×1334
- iPhone 12/13/14: 1170×2532
- iPhone 12/13/14 Pro Max: 1284×2778
- iPhone 15/16: 1179×2556
- iPhone 15/16 Plus: 1290×2796
- iPhone 15/16 Pro Max: 1320×2868
- iPad 10/11: 1668×2388
- iPad Pro 12.9: 2048×2732

Example link pattern:
`<link rel="apple-touch-startup-image" href="assets/ios-splash/apple-startup-light-15-16.png" media="(device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3) and (prefers-color-scheme:light)">`

Add the dark counterpart by changing `light` to `dark` and the media query to `prefers-color-scheme:dark`. Keep the image geometry identical to the in-app BP mark.
