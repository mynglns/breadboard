# LED Flasher / 3D Model Viewer

Minimal browser viewer for the `LED_Flasher_Breadboard.glb` scene.

Open the published URL and the model loads automatically in the browser. No manual download, build step, or package install is required. The GitHub Pages workflow in `.github/workflows/pages.yml` publishes the root of `main` automatically.

## Run locally

Because browsers block ES modules and GLB requests from `file://`, serve the repository over HTTP:

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Explore

- Drag to orbit the model.
- Scroll to zoom.
- Use `Reset` to restore the starting camera view.

## Asset

`assets/LED_Flasher_Breadboard.glb` is the supplied Blender-exported model loaded by the viewer.
