// Script to deduplicate existing map files
const fs = require('fs');
const path = require('path');

function deduplicateArray(array) {
    if (!array || !Array.isArray(array)) return [];
    
    const uniqueItems = [];
    const seen = new Set();
    
    for (const item of array) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
            seen.add(key);
            uniqueItems.push(item);
        }
    }
    
    return uniqueItems;
}

function deduplicateMapData(mapData) {
    let totalRemoved = 0;
    
    // Helper to deduplicate a single level/hole
    function processLevel(level, levelName = '') {
        let removed = 0;
        
        if (level.walls) {
            const before = level.walls.length;
            level.walls = deduplicateArray(level.walls);
            removed = before - level.walls.length;
            totalRemoved += removed;
            if (removed > 0) {
                console.log(`  ${levelName}Walls: ${before} -> ${level.walls.length} (removed ${removed} duplicates)`);
            }
        }
        
        if (level.ramps) {
            const before = level.ramps.length;
            level.ramps = deduplicateArray(level.ramps);
            removed = before - level.ramps.length;
            totalRemoved += removed;
            if (removed > 0) {
                console.log(`  ${levelName}Ramps: ${before} -> ${level.ramps.length} (removed ${removed} duplicates)`);
            }
        }
        
        if (level.powerupSpawns) {
            const before = level.powerupSpawns.length;
            level.powerupSpawns = deduplicateArray(level.powerupSpawns);
            removed = before - level.powerupSpawns.length;
            totalRemoved += removed;
            if (removed > 0) {
                console.log(`  ${levelName}Powerup Spawns: ${before} -> ${level.powerupSpawns.length} (removed ${removed} duplicates)`);
            }
        }
        
        if (level.fans) {
            const before = level.fans.length;
            level.fans = deduplicateArray(level.fans);
            removed = before - level.fans.length;
            totalRemoved += removed;
            if (removed > 0) {
                console.log(`  ${levelName}Fans: ${before} -> ${level.fans.length} (removed ${removed} duplicates)`);
            }
        }
        
        if (level.bouncePads) {
            const before = level.bouncePads.length;
            level.bouncePads = deduplicateArray(level.bouncePads);
            removed = before - level.bouncePads.length;
            totalRemoved += removed;
            if (removed > 0) {
                console.log(`  ${levelName}Bounce Pads: ${before} -> ${level.bouncePads.length} (removed ${removed} duplicates)`);
            }
        }
        
        if (level.bumpers) {
            const before = level.bumpers.length;
            level.bumpers = deduplicateArray(level.bumpers);
            removed = before - level.bumpers.length;
            totalRemoved += removed;
            if (removed > 0) {
                console.log(`  ${levelName}Bumpers: ${before} -> ${level.bumpers.length} (removed ${removed} duplicates)`);
            }
        }
    }
    
    // Handle single-level maps
    processLevel(mapData);
    
    // Handle multi-level maps with "levels" array
    if (mapData.levels && Array.isArray(mapData.levels)) {
        console.log(`  Processing ${mapData.levels.length} levels...`);
        mapData.levels.forEach((level, index) => {
            processLevel(level, `Level ${index + 1} `);
        });
    }
    
    // Handle multi-level maps with "holes" array
    if (mapData.holes && Array.isArray(mapData.holes)) {
        console.log(`  Processing ${mapData.holes.length} holes...`);
        mapData.holes.forEach((hole, index) => {
            processLevel(hole, `Hole ${index + 1} `);
        });
    }
    
    return totalRemoved;
}

// Process all map files
const mapsDir = path.join(__dirname, 'maps');
const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));

console.log(`Found ${files.length} map files to process\n`);

files.forEach(filename => {
    const filepath = path.join(mapsDir, filename);
    console.log(`Processing: ${filename}`);
    
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const mapData = JSON.parse(content);
        
        const sizeBefore = content.length;
        const removed = deduplicateMapData(mapData);
        
        // Save deduplicated version
        const newContent = JSON.stringify(mapData, null, 2);
        const sizeAfter = newContent.length;
        
        fs.writeFileSync(filepath, newContent);
        
        const savedPercent = ((sizeBefore - sizeAfter) / sizeBefore * 100).toFixed(1);
        console.log(`  File size: ${(sizeBefore / 1024).toFixed(1)}KB -> ${(sizeAfter / 1024).toFixed(1)}KB (saved ${savedPercent}%)`);
        console.log(`  Total duplicates removed: ${removed}\n`);
    } catch (error) {
        console.error(`  Error processing ${filename}:`, error.message, '\n');
    }
});

console.log('Deduplication complete!');
