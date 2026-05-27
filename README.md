DepthForge — Blender Postprocess Integration

Blender post-processing is implemented as an opt-in, headless step triggered by the
`/api/postprocess` endpoint. The app enforces headless execution (Blender runs with
`--background`) so no UI is opened during processing.

Setup

- Install Blender on the machine that will run post-processing.
- (Optional) Set the `BLENDER_EXECUTABLE` environment variable to the full path of
  your Blender binary. Examples:

Windows (PowerShell):

```powershell
$env:BLENDER_EXECUTABLE = "C:\Program Files\Blender Foundation\Blender\blender.exe"
```

Linux/macOS (bash):

```bash
export BLENDER_EXECUTABLE=/usr/bin/blender
```

API: Postprocess an existing image

- Endpoint: `POST /api/postprocess`
- JSON body: one of `image_path`, `filename`, or `image_url`.
  - If you pass `/static/generated/<name>` as `image_url` the server will find the file.
  - Example body: `{ "image_url": "/static/generated/abcd1234.png" }`

Example CURL call

```bash
curl -X POST http://localhost:8000/api/postprocess \
  -H "Content-Type: application/json" \
  -d '{"image_url": "/static/generated/example.png"}'
```

Notes

- The server runs Blender in headless mode (`--background`) and captures Blender's
  stdout/stderr. If Blender fails, the `/api/postprocess` response will contain
  an error message with Blender's stderr (where available).
- Running the postprocess requires the host to have Blender installed and the
  Flask/FastAPI process must have permission to launch it.

Testing

After generating an image with `/api/generate`, call `/api/postprocess` with the
returned `image_url` to trigger the headless Blender script.
