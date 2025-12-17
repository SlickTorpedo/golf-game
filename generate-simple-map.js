// Simple Map Generator Example
// This creates a basic valid map structure that AI can use as a template

function generateSimpleMap(name, difficulty = 'easy') {
    const config = getDifficultyConfig(difficulty);
    
    const map = {
        name: name,
        levels: [{
            number: 1,
            name: "Level 1",
            par: config.par,
            startPoint: config.startPoint,
            hole: config.hole,
            walls: config.walls,
            ramps: [],
            powerupSpawns: config.powerupSpawns,
            fans: [],
            bouncePads: [],
            bumpers: config.bumpers,
            speedBoosts: [],
            lava: [],
            spinners: []
        }],
        settings: {
            skyColor: 8900331,    // Sky blue
            groundColor: 2263842, // Forest green
            gravity: -30,
            levelSize: config.levelSize
        }
    };

    return map;
}

function getDifficultyConfig(difficulty) {
    switch (difficulty) {
        case 'easy':
            return {
                levelSize: 60,
                par: 2,
                startPoint: { x: 0, y: 0, z: 25 },
                hole: { x: 0, y: 0, z: -25, radius: 1.2 },
                walls: [
                    // Boundary walls
                    { position: { x: -25, y: 1, z: 0 }, size: { x: 2, y: 2, z: 52 }, rotationY: 0, color: 9127187 },
                    { position: { x: 25, y: 1, z: 0 }, size: { x: 2, y: 2, z: 52 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: -26 }, size: { x: 52, y: 2, z: 2 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: 26 }, size: { x: 52, y: 2, z: 2 }, rotationY: 0, color: 9127187 }
                ],
                powerupSpawns: [
                    { position: { x: -10, y: 1, z: 10 }, color: 16711935 },
                    { position: { x: 10, y: 1, z: 0 }, color: 16711935 },
                    { position: { x: 0, y: 1, z: -10 }, color: 16711935 }
                ],
                bumpers: []
            };

        case 'medium':
            return {
                levelSize: 80,
                par: 3,
                startPoint: { x: -15, y: 0, z: 30 },
                hole: { x: 15, y: 0, z: -30, radius: 1.2 },
                walls: [
                    // Boundary walls
                    { position: { x: -35, y: 1, z: 0 }, size: { x: 2, y: 2, z: 62 }, rotationY: 0, color: 9127187 },
                    { position: { x: 35, y: 1, z: 0 }, size: { x: 2, y: 2, z: 62 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: -31 }, size: { x: 72, y: 2, z: 2 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: 31 }, size: { x: 72, y: 2, z: 2 }, rotationY: 0, color: 9127187 },
                    // Interior walls (obstacles)
                    { position: { x: -10, y: 1, z: 10 }, size: { x: 3, y: 2, z: 20 }, rotationY: 0, color: 9127187 },
                    { position: { x: 10, y: 1, z: -5 }, size: { x: 3, y: 2, z: 25 }, rotationY: 0, color: 9127187 }
                ],
                powerupSpawns: [
                    { position: { x: -20, y: 1, z: 20 }, color: 16711935 },
                    { position: { x: 0, y: 1, z: 15 }, color: 16711935 },
                    { position: { x: 5, y: 1, z: 5 }, color: 16711935 },
                    { position: { x: 20, y: 1, z: -15 }, color: 16711935 },
                    { position: { x: 0, y: 1, z: -20 }, color: 16711935 }
                ],
                bumpers: [
                    { position: { x: 0, y: 0, z: 0 }, rotationY: 0, strength: 15 },
                    { position: { x: -8, y: 0, z: -10 }, rotationY: 0, strength: 15 }
                ]
            };

        case 'hard':
            return {
                levelSize: 100,
                par: 4,
                startPoint: { x: -30, y: 0, z: 40 },
                hole: { x: 30, y: 0, z: -40, radius: 1.2 },
                walls: [
                    // Boundary walls
                    { position: { x: -45, y: 1, z: 0 }, size: { x: 2, y: 3, z: 82 }, rotationY: 0, color: 9127187 },
                    { position: { x: 45, y: 1, z: 0 }, size: { x: 2, y: 3, z: 82 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: -41 }, size: { x: 92, y: 3, z: 2 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: 41 }, size: { x: 92, y: 3, z: 2 }, rotationY: 0, color: 9127187 },
                    // Complex interior walls
                    { position: { x: -20, y: 1, z: 20 }, size: { x: 3, y: 2, z: 30 }, rotationY: 0, color: 9127187 },
                    { position: { x: 0, y: 1, z: 10 }, size: { x: 30, y: 2, z: 3 }, rotationY: 0, color: 9127187 },
                    { position: { x: 20, y: 1, z: -10 }, size: { x: 3, y: 2, z: 35 }, rotationY: 0, color: 9127187 },
                    { position: { x: -10, y: 1, z: -20 }, size: { x: 25, y: 2, z: 3 }, rotationY: 0, color: 9127187 }
                ],
                powerupSpawns: [
                    { position: { x: -30, y: 1, z: 30 }, color: 16711935 },
                    { position: { x: -10, y: 1, z: 25 }, color: 16711935 },
                    { position: { x: 10, y: 1, z: 15 }, color: 16711935 },
                    { position: { x: -15, y: 1, z: 0 }, color: 16711935 },
                    { position: { x: 15, y: 1, z: -5 }, color: 16711935 },
                    { position: { x: 25, y: 1, z: -20 }, color: 16711935 },
                    { position: { x: 0, y: 1, z: -30 }, color: 16711935 }
                ],
                bumpers: [
                    { position: { x: -5, y: 0, z: 5 }, rotationY: 0, strength: 15 },
                    { position: { x: 5, y: 0, z: 5 }, rotationY: 0, strength: 15 },
                    { position: { x: 0, y: 0, z: -5 }, rotationY: 0, strength: 15 },
                    { position: { x: 10, y: 0, z: -15 }, rotationY: 0, strength: 15 }
                ]
            };

        default:
            return getDifficultyConfig('easy');
    }
}

// Example usage
if (require.main === module) {
    const fs = require('fs');
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log('Usage: node generate-simple-map.js <name> [difficulty]');
        console.log('Difficulty: easy, medium, hard (default: easy)');
        console.log('Example: node generate-simple-map.js "My First Course" medium');
        process.exit(1);
    }

    const name = args[0];
    const difficulty = args[1] || 'easy';
    
    const map = generateSimpleMap(name, difficulty);
    const filename = `maps/${name.replace(/[^a-zA-Z0-9 ]/g, '')}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(map, null, 2));
    console.log(`✅ Generated ${difficulty} map: ${filename}`);
    console.log(`   Par: ${map.levels[0].par}`);
    console.log(`   Walls: ${map.levels[0].walls.length}`);
    console.log(`   Powerups: ${map.levels[0].powerupSpawns.length}`);
    console.log(`   Bumpers: ${map.levels[0].bumpers.length}`);
    console.log('\nRun validation: node validate-map.js ' + filename);
}

module.exports = { generateSimpleMap, getDifficultyConfig };
