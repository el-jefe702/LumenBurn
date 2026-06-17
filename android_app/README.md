Android App scaffold for DepthForge

Open this folder in Android Studio (Artisan) and build the `app` module.

Features included:
- Jetpack Compose single-activity scaffold (`MainActivity.kt`)
- Retrofit + OkHttp client stubs (`ApiClient.kt`) connecting to the local edge server
- Basic safety modal flow before launching laser
- WebSocket listener stub for job updates

Quick start:
1. Open `android_app` in Android Studio.
2. Sync Gradle and build the project.
3. Run on a device or emulator.

Notes:
- The app expects the server at `http://10.0.2.2:8000` when using the Android emulator (maps to host localhost).
- Replace endpoints or adjust the base URL in `ApiClient.kt` as needed.

Run & build (emulator)
1. Start your Node server locally (from the repo root):

```bash
npm start
```

2. Open `android_app` in Android Studio, let Gradle sync.
3. Run the default `app` configuration on an Android emulator. The emulator maps host `localhost` to `10.0.2.2`, which the app uses by default.

Run & build (physical device)
1. Connect your Android device via USB and enable USB debugging.
2. Update `ApiClient.kt` `BASE` constant to your host machine IP (e.g. `http://192.168.1.100:8000/`).
3. Build and run the app on the device from Android Studio.

Notes & next steps
- The app currently uses a mock server connector for the Ruida workflow; replace `lib/ruida_mock.js` with a production connector when hardware docs/SDK are available.
- The safety modal enforces typed confirmation and two checkbox confirmations; server also requires `safetyConfirmed=true`.
- To test job updates, open the browser to `http://localhost:8000` and prepare/launch a job via the API or use the app buttons.
