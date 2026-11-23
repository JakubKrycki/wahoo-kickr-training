# KICKR Interval Coach (starter)

A local-first React + TypeScript + Vite prototype for building interval workouts and controlling a Bluetooth FTMS trainer.

## Requirements

- A laptop with Bluetooth LE.
- Recent Google Chrome or Microsoft Edge.
- Node.js 20+ and npm.
- KICKR CORE 2 powered on and not actively controlled by another app.
- Browser access from `localhost` or HTTPS.

## Run locally

```bash
npm install
npm run dev
```

### Development mocks

To simulate the trainer and heart-rate monitor without Bluetooth devices, copy `.env.example` to `.env.local` and enable the relevant flags. The heart-rate mock generates a fluctuating BPM reading once per second and is only enabled in development.

Open the localhost URL printed by Vite (normally http://localhost:5173). Click **Connect KICKR over Bluetooth** and select the trainer.

Build a production bundle:

```bash
npm run build
npm run preview
```

## Important prototype limitations

1. **Hardware validation is required.** The app uses the standard Bluetooth Fitness Machine Service (FTMS), including Request Control (`0x00`) and Set Target Power (`0x05`). The KICKR CORE 2 advertises Bluetooth connectivity, but the exact GATT services, control-point response behavior and target-power support must be verified against your trainer and firmware before relying on this app.
2. This is a starter prototype, not a medically validated training product. Use a fan, hydrate, stay alert, and stop if you feel unwell. FTP tests are maximal efforts; consider your health and training experience before performing one.
3. The 20-minute test is a basic protocol: FTP estimate = 95% of average 20-minute power. A commonly used protocol includes a progressive warm-up and a hard 5-minute effort before the 20-minute effort. This prototype currently records a manually performed, self-paced 20-minute test result; its automated 20-minute free-ride control is intentionally disabled until trainer-specific non-ERG control is validated.
4. Ramp-test FTP estimate uses 75% of the highest fully completed one-minute stage. Ramp protocols differ; do not compare results from different protocols as if they were identical.
5. The first version keeps settings in browser localStorage. Export/import, structured workout blocks, robust pause/resume, workout recording, and detailed BLE telemetry are planned improvements.
6. BLE disconnects, control-point timeouts and unsupported trainer features must be handled conservatively. If target-power control is not confirmed, do not use the app for hard intervals.

## Safety / control notes

- Do not have Wahoo, Zwift, or another training app connected to the trainer simultaneously.
- Keep the physical stop option accessible. The app's Stop button sends the FTMS Stop command on a best-effort basis.
- Test Bluetooth connection and low target powers before attempting a maximal workout.
- A browser tab must remain open and awake throughout a workout.

## Project structure

- `src/ftms.ts`: FTMS Bluetooth communication.
- `src/App.tsx`: workout builder, FTP screens and session timer.
- `src/style.css`: visual styling.

## FTMS references

- Bluetooth SIG Fitness Machine Service specification: https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/
- MDN Web Bluetooth API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- Wahoo KICKR CORE 2 support/specifications: https://support.wahoofitness.com/


## Optional HeartCast heart-rate connection

1. Open HeartCast on both the iPhone and Apple Watch and start its heart-rate broadcast.
2. In the app, connect the KICKR in the connection dialog.
3. In the same dialog, choose **Connect HeartCast** and select the HeartCast / heart-rate device in the Bluetooth picker.
4. Press **Continue**. Live BPM appears in the **HEART RATE** metric on the Live session tile.
5. To manage it later, use **Connections** in the app header.

Heart rate is optional: the KICKR trainer is still required, but workouts work normally without a heart-rate monitor. The app reads the standard Bluetooth LE Heart Rate service, so use Chrome or Edge on Windows and keep HeartCast broadcasting while riding. If the device does not appear, restart the broadcast in HeartCast and try Connect HeartCast again.
