# Golf Game Map Generation Framework

This framework provides complete specifications for AI models to generate valid mini-golf level JSON files.

## Table of Contents
1. [Map Structure Overview](#map-structure-overview)
2. [JSON Schema](#json-schema)
3. [Coordinate System](#coordinate-system)
4. [Required Elements](#required-elements)
5. [Object Types Reference](#object-types-reference)
6. [Design Rules & Constraints](#design-rules--constraints)
7. [Color Reference](#color-reference)
8. [Examples](#examples)
9. [Validation Checklist](#validation-checklist)

---

## Map Structure Overview

Maps can be either **single-level** or **multi-level** (course). The game uses a 3D coordinate system where:
- **X axis**: Left (-) to Right (+)
- **Y axis**: Down (-) to Up (+)
- **Z axis**: Back (+) to Front (-)

The ball starts at `startPoint` and must reach the `hole`.

---

## JSON Schema

### Multi-Level Map Structure
```json
{
  "name": "Map Name",
  "levels": [
    {
      "number": 1,
      "name": "Level 1",
      "par": 3,
      "startPoint": { "x": 0, "y": 0, "z": 30 },
      "hole": { "x": 0, "y": 0, "z": -30, "radius": 1.2 },
      "walls": [],
      "ramps": [],
      "powerupSpawns": [],
      "fans": [],
      "bouncePads": [],
      "bumpers": [],
      "speedBoosts": [],
      "lava": [],
      "spinners": []
    }
  ],
  "settings": {
    "skyColor": 8900331,
    "groundColor": 2263842,
    "gravity": -30,
    "levelSize": 100
  }
}
```

### Single-Level Map Structure
Same as multi-level but without the `levels` array wrapper. Objects go directly in the root.

---

## Coordinate System

### Typical Level Dimensions
- **Small level**: 40x40 units (20 units from center in each direction)
- **Medium level**: 80x80 units (40 units from center)
- **Large level**: 120x120 units (60 units from center)

### Y-Axis (Height) Guidelines
- **Ground level**: y = 0
- **Wall height**: typically 2-4 units
- **Elevated platforms**: y = 2-10 units
- **Ball spawns at**: startPoint.y (usually 0)

---

## Required Elements

### 1. Start Point
```json
"startPoint": {
  "x": 0,
  "y": 0,
  "z": 30
}
```
- **Y should always be 0** (ground level) unless on a platform
- Place away from walls (minimum 5 units clearance)
- Should have clear path toward the hole

### 2. Hole (Goal)
```json
"hole": {
  "x": 0,
  "y": 0,
  "z": -30,
  "radius": 1.2
}
```
- **radius**: Always use `1.2` (standard hole size)
- **Y should be 0** unless on a platform
- Must be reachable from the start point
- Keep 3-5 units away from walls

### 3. Boundary Walls
**CRITICAL**: Every level MUST have boundary walls that contain the play area.

Minimum required walls (for a 40x40 level centered at origin):
```json
"walls": [
  {
    "position": { "x": -20, "y": 1, "z": 0 },
    "size": { "x": 2, "y": 2, "z": 40 },
    "rotationY": 0,
    "color": 9127187
  },
  {
    "position": { "x": 20, "y": 1, "z": 0 },
    "size": { "x": 2, "y": 2, "z": 40 },
    "rotationY": 0,
    "color": 9127187
  },
  {
    "position": { "x": 0, "y": 1, "z": -20 },
    "size": { "x": 40, "y": 2, "z": 2 },
    "rotationY": 0,
    "color": 9127187
  },
  {
    "position": { "x": 0, "y": 1, "z": 20 },
    "size": { "x": 40, "y": 2, "z": 2 },
    "rotationY": 0,
    "color": 9127187
  }
]
```

---

## Object Types Reference

### Walls
Solid barriers that balls bounce off of.
```json
{
  "position": { "x": 0, "y": 1, "z": 0 },
  "size": { "x": 4, "y": 2, "z": 4 },
  "rotationY": 0,
  "color": 9127187
}
```
- **position**: Center point of the wall
- **size**: Dimensions (width, height, depth)
- **rotationY**: Rotation in degrees (0, 45, 90, etc.)
- **color**: Decimal color value (see Color Reference)
- **Typical height**: 2-4 units

### Ramps
Sloped surfaces to reach higher areas.
```json
{
  "position": { "x": 0, "y": 0.25, "z": 0 },
  "size": { "x": 8, "y": 0.5, "z": 6 },
  "rotationY": 0,
  "angle": 15,
  "color": 7048739
}
```
- **angle**: Slope angle in degrees (5-30 typical, max 45)
- **position.y**: Usually half of size.y (base of ramp)
- **Low angle (5-15°)**: Gentle slopes
- **Medium angle (15-25°)**: Standard ramps
- **High angle (25-45°)**: Steep ramps

### Powerup Spawns
Random powerup pickup locations.
```json
{
  "position": { "x": 5, "y": 1, "z": 10 },
  "color": 16711935
}
```
- **Y-position**: 1 unit above ground (or platform surface + 1)
- **color**: Always `16711935` (magenta)
- **Placement**: 3-8 spawns per level
- Place along the path, not in corners
- Keep 2+ units away from walls

### Fans
Create wind force in a direction.
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "rotationY": 0,
  "angle": 0,
  "strength": 10
}
```
- **rotationY**: Direction fan points (0 = north, 90 = east, 180 = south, 270 = west)
- **angle**: Vertical angle (-45 to 45, 0 = horizontal)
- **strength**: Force magnitude (5-20 typical)

### Bounce Pads
Launch balls upward.
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "rotationY": 0,
  "strength": 20
}
```
- **strength**: Bounce power (10-30 typical)
- Use to reach elevated areas
- Place before gaps or elevated platforms

### Bumpers
Circular obstacles that repel balls.
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "rotationY": 0,
  "strength": 15
}
```
- **strength**: Repel force (10-20 typical)
- Place in open areas as obstacles
- Create patterns (triangle, line, etc.)

### Speed Boosts
Accelerate balls in a direction.
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "rotationY": 270,
  "strength": 50
}
```
- **rotationY**: Direction of boost
- **strength**: Speed multiplier (30-70 typical)
- Use for long shots or gaps

### Lava
Hazard zones that reset the ball.
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "size": { "x": 10, "y": 0.2, "z": 10 }
}
```
- **Y-position**: Slightly below ground (0 or -0.1)
- Creates risk/reward scenarios

### Spinners
Rotating obstacles.
```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "size": { "x": 8, "y": 1, "z": 2 },
  "rotationY": 0,
  "speed": 50,
  "color": 16776960
}
```
- **speed**: Rotation speed (30-100 typical)
- **size**: Dimensions of the spinning bar

---

## Design Rules & Constraints

### 1. Containment (CRITICAL)
- **MUST** have 4 boundary walls enclosing the entire play area
- Walls must be tall enough (height ≥ 2) to prevent ball escape
- Check that startPoint and hole are inside the boundaries

### 2. Reachability
- There MUST be a valid path from startPoint to hole
- Consider ball physics: can't climb vertical walls, needs ramps for height
- Test mentally: "Can the ball reach this?"

### 3. Par Calculation
```
Par = (Straight-line distance from start to hole) / 20
```
- Minimum par: 2
- Add +1 for each major obstacle
- Add +1 for elevation changes
- Typical range: 2-5 strokes

### 4. Object Spacing
- Keep 2+ units between objects to prevent overlap
- Walls can touch (forming corners) but shouldn't intersect
- Powerups need 3+ units clearance

### 5. Difficulty Progression
- **Easy** (Par 2-3): Straight path, few obstacles, wide spaces
- **Medium** (Par 3-4): Some turns, moderate obstacles, strategic placement
- **Hard** (Par 4-5): Complex paths, tight spaces, precision required, elevation changes

### 6. Powerup Placement
- 3-5 powerups for small levels
- 5-8 powerups for medium levels
- 8-12 powerups for large levels
- Place along the expected path
- Some should require risk (near bumpers or gaps)

### 7. Elevation Design
- Use ramps to connect different heights
- Ensure ramp length is sufficient: `length ≥ height / tan(angle)`
- For a 3-unit height change with 15° ramp: need ~11 units length
- Place bounce pads at base of tall platforms as alternative

---

## Color Reference

### Standard Colors (Decimal Values)
```javascript
// Walls & Obstacles
9127187   // Brown (0x8B4513) - Default walls
7048739   // Olive (0x6B8E23) - Default ramps
8421504   // Gray (0x808080) - Metal/Stone
6710886   // Dark Gray (0x666666)

// Powerups & Special
16711935  // Magenta (0xFF00FF) - Powerup spawns
16776960  // Yellow (0xFFFF00) - Spinners
255       // Blue (0x0000FF) - Ice/water
16711680  // Red (0xFF0000) - Danger/lava

// Environment
8900331   // Sky Blue (0x87CEEB) - Default sky
2263842   // Forest Green (0x228B22) - Default ground
3329330   // Dark Green (0x32CD32) - Alternate ground
```

### Converting Hex to Decimal
```javascript
0x8B4513 = 9127187
0xFF00FF = 16711935
```

---

## Examples

### Example 1: Simple Straight Course
```json
{
  "name": "First Shot",
  "levels": [{
    "number": 1,
    "name": "Level 1",
    "par": 2,
    "startPoint": { "x": 0, "y": 0, "z": 25 },
    "hole": { "x": 0, "y": 0, "z": -25, "radius": 1.2 },
    "walls": [
      { "position": { "x": -15, "y": 1, "z": 0 }, "size": { "x": 2, "y": 2, "z": 52 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 15, "y": 1, "z": 0 }, "size": { "x": 2, "y": 2, "z": 52 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 0, "y": 1, "z": -26 }, "size": { "x": 32, "y": 2, "z": 2 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 0, "y": 1, "z": 26 }, "size": { "x": 32, "y": 2, "z": 2 }, "rotationY": 0, "color": 9127187 }
    ],
    "ramps": [],
    "powerupSpawns": [
      { "position": { "x": -5, "y": 1, "z": 10 }, "color": 16711935 },
      { "position": { "x": 5, "y": 1, "z": -5 }, "color": 16711935 }
    ],
    "fans": [],
    "bouncePads": [],
    "bumpers": [],
    "speedBoosts": [],
    "lava": [],
    "spinners": []
  }],
  "settings": {
    "skyColor": 8900331,
    "groundColor": 2263842,
    "gravity": -30,
    "levelSize": 60
  }
}
```

### Example 2: Course with Obstacles
```json
{
  "name": "Bumper Alley",
  "levels": [{
    "number": 1,
    "name": "Level 1",
    "par": 3,
    "startPoint": { "x": 0, "y": 0, "z": 30 },
    "hole": { "x": 0, "y": 0, "z": -30, "radius": 1.2 },
    "walls": [
      { "position": { "x": -20, "y": 1, "z": 0 }, "size": { "x": 2, "y": 2, "z": 62 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 20, "y": 1, "z": 0 }, "size": { "x": 2, "y": 2, "z": 62 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 0, "y": 1, "z": -31 }, "size": { "x": 42, "y": 2, "z": 2 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 0, "y": 1, "z": 31 }, "size": { "x": 42, "y": 2, "z": 2 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": -8, "y": 1, "z": 0 }, "size": { "x": 3, "y": 2, "z": 15 }, "rotationY": 0, "color": 9127187 },
      { "position": { "x": 8, "y": 1, "z": 0 }, "size": { "x": 3, "y": 2, "z": 15 }, "rotationY": 0, "color": 9127187 }
    ],
    "ramps": [],
    "powerupSpawns": [
      { "position": { "x": -10, "y": 1, "z": 15 }, "color": 16711935 },
      { "position": { "x": 10, "y": 1, "z": 5 }, "color": 16711935 },
      { "position": { "x": 0, "y": 1, "z": -10 }, "color": 16711935 }
    ],
    "fans": [],
    "bouncePads": [],
    "bumpers": [
      { "position": { "x": 0, "y": 0, "z": 10 }, "rotationY": 0, "strength": 15 },
      { "position": { "x": -5, "y": 0, "z": 0 }, "rotationY": 0, "strength": 15 },
      { "position": { "x": 5, "y": 0, "z": 0 }, "rotationY": 0, "strength": 15 },
      { "position": { "x": 0, "y": 0, "z": -10 }, "rotationY": 0, "strength": 15 }
    ],
    "speedBoosts": [],
    "lava": [],
    "spinners": []
  }],
  "settings": {
    "skyColor": 8900331,
    "groundColor": 2263842,
    "gravity": -30,
    "levelSize": 80
  }
}
```

### Example 3: Multi-Level Course
Create multiple levels in the `levels` array. Each level follows the same structure.

---

## Validation Checklist

Before submitting a generated map, verify:

- [ ] **Has boundary walls** on all 4 sides
- [ ] **Start point** is inside boundaries
- [ ] **Hole** is inside boundaries
- [ ] **Path exists** from start to hole
- [ ] **No overlapping objects** (check coordinates)
- [ ] **All powerups** have Y-position = 1 (or platform height + 1)
- [ ] **All holes** have radius = 1.2
- [ ] **Par value** is reasonable (2-5)
- [ ] **Walls are tall enough** (height ≥ 2)
- [ ] **Ramps have valid angles** (5-45 degrees)
- [ ] **All required arrays** are present (even if empty)
- [ ] **Colors are decimal values**, not hex
- [ ] **Level number** matches array index + 1
- [ ] **Settings object** is present with all required fields

---

## Usage Instructions for AI

When given a level description:

1. **Parse the requirements**: difficulty, theme, obstacles, size
2. **Calculate dimensions**: determine levelSize and boundary coordinates
3. **Place start and hole**: ensure proper spacing (40-80 units apart for par 3-4)
4. **Create boundary walls**: 4 walls enclosing the area
5. **Add obstacles**: walls, ramps, bumpers based on difficulty
6. **Place powerups**: 3-8 spawns along the path
7. **Add special elements**: fans, bounce pads, speed boosts as needed
8. **Calculate par**: based on distance and complexity
9. **Set colors**: use standard color palette
10. **Validate**: run through checklist above

### Common Pitfalls to Avoid
- ❌ Forgetting boundary walls
- ❌ Using hex colors instead of decimal
- ❌ Placing hole outside boundaries
- ❌ Creating impossible paths (e.g., ball can't reach elevated hole without ramp)
- ❌ Overlapping objects at same coordinates
- ❌ Missing required arrays (leave empty `[]` instead)
- ❌ Powerups at Y=0 (they float at Y=1)
- ❌ Hole radius other than 1.2

---

## Advanced Tips

### Creating Interesting Layouts

**Maze Style**: Use walls to create narrow corridors
```json
{ "position": { "x": 0, "y": 1, "z": 10 }, "size": { "x": 20, "y": 2, "z": 2 }, "rotationY": 0, "color": 9127187 }
```

**Island Hopping**: Small platforms with gaps, use bounce pads
```json
{ "position": { "x": 10, "y": 0, "z": 0 }, "rotationY": 0, "strength": 25 }
```

**Elevated Green**: Hole on platform, requires ramp or bounce pad
```json
"hole": { "x": 0, "y": 3, "z": -25, "radius": 1.2 }
```

**Wind Tunnel**: Fans pushing ball through narrow space
```json
{ "position": { "x": 0, "y": 0, "z": 0 }, "rotationY": 180, "angle": 0, "strength": 15 }
```

### Difficulty Scaling
- **Par 2**: 20-40 units, straight shot, 1-2 obstacles
- **Par 3**: 40-60 units, 1 turn, 3-5 obstacles
- **Par 4**: 60-80 units, multiple turns, 6-10 obstacles
- **Par 5**: 80+ units, complex path, 10+ obstacles, elevation changes

---

## Final Notes

- **Keep it playable**: Don't make levels impossible
- **Test mentally**: Imagine hitting the ball - can it reach the goal?
- **Balance risk/reward**: Powerups near hazards create interesting choices
- **Theme consistency**: Use similar colors for objects in same level
- **Progressive difficulty**: Later levels should be harder

Good luck creating amazing golf courses! 🏌️‍♂️⛳
