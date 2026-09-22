# LED Flasher / Interactive Build

An interactive Three.js viewer for the `LED_Flasher_Breadboard.glb` scene.

The site is intentionally static: the model, interface, and viewer logic live in the repository and load in any modern browser. The GitHub Pages workflow in `.github/workflows/pages.yml` publishes the root of `main` automatically once Pages is configured to use GitHub Actions.

## Run locally

Because browsers block ES modules and GLB requests from `file://`, serve the repository over HTTP:

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Explore

- Drag in the viewport to orbit the model and scroll to zoom.
- Click a mesh or a part row to focus a component.
- Use `Run signal` and `Blink rate` to change the simulated alternating LED pulse.
- `Auto orbit` and `Reset view` are available below the model.

## Asset

`assets/LED_Flasher_Breadboard.glb` is the supplied Blender-exported model. The viewer uses the model's `D1`, `D2`, `Q1`, `Q2`, `C1`, and `C2` node naming to make the 3D scene selectable.
