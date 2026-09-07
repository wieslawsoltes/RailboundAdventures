# Driving and world controls

## Driving

Begin your journey is a convenience setup action, not an autopilot. It releases
brakes and applies approximately 58% throttle. You remain responsible for speed
and stations, with automatic train protection enabled by default.

| Action | Keyboard / interaction |
| --- | --- |
| Increase / decrease power | Hold W / S, or drag Power slider. |
| Apply / release train brake | Hold D / A, or drag Brake slider. |
| Emergency brake | Space, or red emergency button. Reset only after stopping. |
| Cycle reverser forward → neutral → reverse | R, while stopped. |
| Passenger doors | O, while stopped; open doors inhibit power. |
| Pantograph | P; an electric train also needs line electrification and master power. |
| Lights / wipers | L / K. |
| Horn | Hold H or the horn button. Audio needs a user gesture. |
| Sand | Hold X, or advanced-system sanding control. |
| Pause / resume | Esc when no dialog is open, or Pause button. |
| Map | M. |
| Export JSON project | Ctrl+S or Command+S. |

The locomotive-systems panel exposes the independent brake, dynamic brake,
parking brake, master switch, reverser, consist length and supply controls.
Always close doors, release parking and train brakes, select a direction and
supply power before attempting a manual departure. Applied air brakes release
progressively as pipe pressure recharges; setting the slider to zero is not an
instant removal of all braking force.

For a passenger call, stop with the locomotive within 18 metres of the station
marker, at less than 0.15 m/s, and open the doors for 20 seconds. The service log
records completion; close doors before departing. Plan braking in advance, in
particular on downhill sections and with long, heavy consists. Stock maximum
speed and the current route's permitted speed are different quantities.

## Cameras

| Key | Camera |
| --- | --- |
| 1 | Cab. Drag to look through the cab windows; HUD provides live instruments. |
| 2 | Chase. Drag to adjust offset; follows the train. |
| 3 | Orbit. Inspect the train from different directions. |
| 4 | Aerial. High-level overview of train and surroundings. |
| 5 | Trackside. Watches the train pass a point along its route. |
| 6 | Free. WASD translation, Q/E vertical, Shift for faster movement. |
| C | Cycle the six cameras. |

Mouse drag or single-finger drag changes view direction. Mouse wheel or two-finger
pinch changes zoom. Train W/S/A/D keyboard control is intentionally suspended in
free-flight mode because those keys move the camera; the driving sliders remain
available.

## Mobile and gamepad

The portrait and landscape layouts retain throttle, brake, speed, emergency,
view and world tools. Dialogs scroll; map/editor settings remain accessible below
the canvas in narrow viewports. Use medium or low graphics quality, lower render
resolution and disabled shadows when the device is struggling.

Standard gamepad mapping: right trigger power; left trigger train brake; right
stick view; A camera; B emergency; X doors; Y horn. This mapping is implemented,
but physical controllers and browser-specific mappings were not exercised during
delivery testing. It is not a safety-certified input system.

## World editor

Open Editor. Changes are staged until Apply. Tree, building and rock tools place
objects on the map. Raise/lower modifies actual terrain height using a radius and
strength. Add station creates a platform/stop on nearby rail. Custom track is a
closed loop authored from at least four well-separated map points; its elevation
is configurable. Reset track returns to the world's generated alignment.

Undo/redo operates on staged editor changes. Apply rebuilds railway and scenery,
stops and secures the player near the old position, and removes AI services so
old paths do not reference a changed topology. Apply is therefore not a
continuous, train-in-motion civil-engineering operation. Export the project to
retain the full world, seed and edits between devices.

Limits include 150 track control points, a 75 km control-polygon length cap,
1,500 placed objects, 250 terrain brushes and 50 added stations. Neighboring
track points must be at least 25 m apart. These bounds protect project loading
from unreasonable memory and geometry requests, not guarantee good civil design.

## Dispatch and recovery

Dispatch adds/removes AI services, allows takeover, holds the next signal and
changes the main/branch turnout. The turnout locks when a train occupies the
approach or fouling area. Carriages follow the route already taken by their
locomotive even if the turnout changes later.

The map can reposition a stopped player train on unoccupied rail. After a
collision, reposition onto clear track before using Setup → Recover stopped
train. Emergency braking is not the same as recovering an overspeed/collision
failure. Automatic train protection can be disabled in Setup for experimentation;
that does not turn this into a real-world safety model.

## Save, reset and screenshots

Setup → Export project creates a transferable JSON project. Open project restores
it. Save in this browser and automatic saves use localStorage; browser privacy
settings or file origins may make this unavailable. Restore autosave is explicit
so opening the game first shows a predictable default demonstration.

The photo button exports the next rendered 3D frame as PNG, without the HTML HUD.
Hide controls is available in Setup; a restore button remains accessible. Loading
another world creates a new railway and trains. Export your current project
before replacing it when you need to retain its edits or progress.
