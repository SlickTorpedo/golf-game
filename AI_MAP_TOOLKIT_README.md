# Golf Game AI Map Generation Toolkit

This toolkit provides everything needed for AI models to generate valid mini-golf course JSON files for the golf game.

## 📚 Complete Framework Documentation

**[MAP_GENERATION_FRAMEWORK.md](MAP_GENERATION_FRAMEWORK.md)** - Comprehensive guide containing:
- Complete JSON schema and structure
- Coordinate system explanation  
- All object types (walls, ramps, powerups, fans, etc.)
- Design rules and constraints
- Color reference table
- Detailed examples
- Validation checklist

## 🛠️ Tools Included

### 1. Map Validator (`validate-map.js`)
Validates map JSON files to ensure they meet all requirements.

```bash
# Validate a map file
node validate-map.js maps/MyLevel.json
```

**Checks:**
- ✅ Required fields (startPoint, hole, walls)
- ✅ Boundary walls present
- ✅ Hole radius is 1.2
- ✅ Objects aren't overlapping
- ✅ Par value is reasonable
- ✅ Wall heights are sufficient
- ✅ All required arrays exist

### 2. Map Generator (`generate-simple-map.js`)
Creates template maps that AI can use as starting points.

```bash
# Generate an easy map
node generate-simple-map.js "Tutorial Course" easy

# Generate a medium difficulty map
node generate-simple-map.js "Championship Course" medium

# Generate a hard map
node generate-simple-map.js "Expert Challenge" hard
```

### 3. Map Deduplicator (`deduplicate-maps.js`)
Removes duplicate objects from existing map files (useful after editing).

```bash
# Clean up a map file
node deduplicate-maps.js
```

## 🚀 Quick Start for AI Models

### Step 1: Read the Framework
Study **[MAP_GENERATION_FRAMEWORK.md](MAP_GENERATION_FRAMEWORK.md)** to understand:
- The JSON structure
- What objects are available
- Design rules and constraints

### Step 2: Generate a Map
When given a request like "Create a challenging mini-golf course with obstacles":

1. Decide on difficulty and size
2. Place startPoint and hole with appropriate distance
3. Create 4 boundary walls
4. Add interior walls/obstacles based on difficulty
5. Place 3-8 powerup spawns
6. Add special objects (bumpers, ramps, etc.)
7. Calculate appropriate par value
8. Validate the output

### Step 3: Validate Your Map
```bash
node validate-map.js "maps/Your Generated Map.json"
```

Fix any errors and address warnings.

## 📋 Example AI Workflow

```
User: "Create a Par 3 course with bumpers and a narrow path"

AI Process:
1. Read framework → Par 3 = ~60 units distance
2. Set startPoint: {x: 0, y: 0, z: 25}
3. Set hole: {x: 0, y: 0, z: -25, radius: 1.2}
4. Create boundary walls (4 sides, 50x50 area)
5. Add narrow corridor walls to create path
6. Place 4-5 bumpers as obstacles
7. Add 4 powerup spawns along path
8. Calculate par: 3 (matches request)
9. Generate JSON
10. Validate with tool
```

## 🎯 Key Rules for AI

### MUST HAVE:
- ✅ 4 boundary walls enclosing the play area
- ✅ startPoint and hole inside boundaries
- ✅ hole.radius = 1.2 (always)
- ✅ All required arrays (even if empty)
- ✅ Colors as decimal values (not hex)

### MUST NOT:
- ❌ Use hex colors (convert to decimal)
- ❌ Forget boundary walls
- ❌ Place objects outside play area
- ❌ Create impossible paths
- ❌ Overlap objects at same position

### SHOULD:
- ⭐ Place 3-8 powerup spawns per level
- ⭐ Use Y=0 for ground-level objects
- ⭐ Use Y=1 for floating objects (powerups)
- ⭐ Keep 2+ unit spacing between objects
- ⭐ Make par proportional to distance/complexity

## 📝 Map Structure Quick Reference

```json
{
  "name": "Course Name",
  "levels": [{
    "number": 1,
    "name": "Level 1",
    "par": 3,
    "startPoint": { "x": 0, "y": 0, "z": 30 },
    "hole": { "x": 0, "y": 0, "z": -30, "radius": 1.2 },
    "walls": [/* 4+ walls */],
    "ramps": [],
    "powerupSpawns": [/* 3-8 spawns */],
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
    "levelSize": 80
  }
}
```

## 🎨 Common Colors (Decimal)

```
9127187  - Brown (walls)
7048739  - Olive (ramps)
16711935 - Magenta (powerups)
8900331  - Sky blue (sky)
2263842  - Forest green (ground)
16711680 - Red (danger/lava)
```

## 🐛 Bug Fixes Applied

This toolkit includes fixes for critical bugs:
- ✅ **Wall Duplication Bug**: Fixed in [EditorHistory.js](public/js/editor/EditorHistory.js#L85-L90)
  - Removed duplicate `walls.push()` in `restoreState()` method
- ✅ **Save Deduplication**: Added in [EditorFileIO.js](public/js/editor/EditorFileIO.js)
  - Deduplicates all arrays before saving to prevent bloat
- ✅ **Existing Maps**: Cleaned up with deduplication script
  - Reduced file sizes by up to 99.8%

## 📖 Additional Resources

- **Full Framework**: [MAP_GENERATION_FRAMEWORK.md](MAP_GENERATION_FRAMEWORK.md)
- **Example Maps**: Check `maps/` directory for valid examples
- **Validator Tool**: `validate-map.js` with detailed error messages
- **Generator Tool**: `generate-simple-map.js` for templates

## 💡 Tips for Creating Great Maps

1. **Start Simple**: Use the generator to create a base map, then modify
2. **Test Mentally**: Imagine playing - can the ball reach the hole?
3. **Balance Difficulty**: More obstacles = higher par
4. **Use Powerups Wisely**: Place them strategically, not randomly
5. **Validate Early**: Run validator frequently during generation
6. **Study Examples**: Look at existing maps in `maps/` folder

## 🤝 Contributing

When creating new maps:
1. Generate the JSON following the framework
2. Validate with `validate-map.js`
3. Test in-game if possible
4. Share your creations!

---

**Happy Course Building!** 🏌️‍♂️⛳
