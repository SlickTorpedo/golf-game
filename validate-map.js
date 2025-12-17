// Map Validation Script
// Run with: node validate-map.js <path-to-map.json>

const fs = require('fs');
const path = require('path');

class MapValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    validate(mapData) {
        this.errors = [];
        this.warnings = [];

        // Check if it's a multi-level map
        if (mapData.levels && Array.isArray(mapData.levels)) {
            console.log(`Validating multi-level map: "${mapData.name}" (${mapData.levels.length} levels)`);
            mapData.levels.forEach((level, index) => {
                console.log(`\n--- Level ${index + 1}: "${level.name}" ---`);
                this.validateLevel(level, index + 1);
            });
        } else {
            console.log(`Validating single-level map: "${mapData.name}"`);
            this.validateLevel(mapData, 1);
        }

        // Validate settings
        this.validateSettings(mapData.settings);

        return {
            valid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    validateLevel(level, levelNumber) {
        // Check required fields
        this.checkRequired(level, 'startPoint', levelNumber);
        this.checkRequired(level, 'hole', levelNumber);
        this.checkRequired(level, 'walls', levelNumber);

        // Validate start point
        if (level.startPoint) {
            if (level.startPoint.y !== 0) {
                this.warnings.push(`Level ${levelNumber}: Start point Y is ${level.startPoint.y} (typically should be 0)`);
            }
        }

        // Validate hole
        if (level.hole) {
            if (level.hole.radius !== 1.2) {
                this.errors.push(`Level ${levelNumber}: Hole radius is ${level.hole.radius} (must be 1.2)`);
            }
            if (level.hole.y !== 0) {
                this.warnings.push(`Level ${levelNumber}: Hole Y is ${level.hole.y} (typically should be 0 unless on platform)`);
            }
        }

        // Validate walls
        if (level.walls && Array.isArray(level.walls)) {
            if (level.walls.length < 4) {
                this.errors.push(`Level ${levelNumber}: Only ${level.walls.length} walls found (need at least 4 boundary walls)`);
            }

            // Check for boundary walls
            const hasBoundaries = this.checkBoundaryWalls(level.walls, level);
            if (!hasBoundaries) {
                this.errors.push(`Level ${levelNumber}: Missing complete boundary walls`);
            }

            // Check wall heights
            level.walls.forEach((wall, idx) => {
                if (wall.size && wall.size.y < 2) {
                    this.warnings.push(`Level ${levelNumber}: Wall ${idx + 1} height is ${wall.size.y} (recommend ≥ 2)`);
                }
            });
        } else {
            this.errors.push(`Level ${levelNumber}: No walls array found`);
        }

        // Validate ramps
        if (level.ramps && Array.isArray(level.ramps)) {
            level.ramps.forEach((ramp, idx) => {
                if (ramp.angle < 5 || ramp.angle > 45) {
                    this.warnings.push(`Level ${levelNumber}: Ramp ${idx + 1} angle is ${ramp.angle}° (recommend 5-45°)`);
                }
            });
        }

        // Validate powerup spawns
        if (level.powerupSpawns && Array.isArray(level.powerupSpawns)) {
            level.powerupSpawns.forEach((spawn, idx) => {
                if (spawn.position.y !== 1 && spawn.position.y !== 0) {
                    this.warnings.push(`Level ${levelNumber}: Powerup ${idx + 1} Y is ${spawn.position.y} (typically should be 1)`);
                }
                if (spawn.color !== 16711935) {
                    this.warnings.push(`Level ${levelNumber}: Powerup ${idx + 1} color is ${spawn.color} (standard is 16711935)`);
                }
            });

            // Check powerup count
            const count = level.powerupSpawns.length;
            if (count === 0) {
                this.warnings.push(`Level ${levelNumber}: No powerup spawns (recommend 3-8)`);
            } else if (count < 3) {
                this.warnings.push(`Level ${levelNumber}: Only ${count} powerup spawns (recommend 3-8)`);
            } else if (count > 12) {
                this.warnings.push(`Level ${levelNumber}: ${count} powerup spawns (may be too many, recommend 3-12)`);
            }
        }

        // Check for required arrays
        const requiredArrays = ['walls', 'ramps', 'powerupSpawns', 'fans', 'bouncePads', 'bumpers'];
        requiredArrays.forEach(arr => {
            if (!level[arr]) {
                this.warnings.push(`Level ${levelNumber}: Missing '${arr}' array (should be present even if empty)`);
            }
        });

        // Validate par
        if (level.par) {
            if (level.par < 2 || level.par > 7) {
                this.warnings.push(`Level ${levelNumber}: Par is ${level.par} (typical range is 2-5)`);
            }

            // Calculate expected par based on distance
            if (level.startPoint && level.hole) {
                const distance = this.calculateDistance(level.startPoint, level.hole);
                const expectedPar = Math.max(2, Math.round(distance / 20));
                if (Math.abs(level.par - expectedPar) > 1) {
                    this.warnings.push(`Level ${levelNumber}: Par is ${level.par} but distance suggests ~${expectedPar} (distance: ${distance.toFixed(1)})`);
                }
            }
        }

        // Check for overlapping objects
        this.checkOverlaps(level, levelNumber);

        // Check if hole is reachable
        if (level.startPoint && level.hole) {
            const contained = this.checkContainment(level);
            if (!contained.startInside) {
                this.warnings.push(`Level ${levelNumber}: Start point may be outside or very close to boundary walls`);
            }
            if (!contained.holeInside) {
                this.warnings.push(`Level ${levelNumber}: Hole may be outside or very close to boundary walls`);
            }
        }
    }

    checkRequired(obj, field, levelNumber) {
        if (!obj[field]) {
            this.errors.push(`Level ${levelNumber}: Missing required field '${field}'`);
        }
    }

    checkBoundaryWalls(walls, level) {
        // Simple heuristic: check if we have walls on all 4 sides
        let hasLeft = false, hasRight = false, hasFront = false, hasBack = false;

        walls.forEach(wall => {
            if (!wall.position || !wall.size) return;

            const extent = {
                xMin: wall.position.x - wall.size.x / 2,
                xMax: wall.position.x + wall.size.x / 2,
                zMin: wall.position.z - wall.size.z / 2,
                zMax: wall.position.z + wall.size.z / 2
            };

            // Check if wall spans a significant portion of a side
            if (wall.size.z > wall.size.x && wall.size.z > 20) {
                if (extent.xMin < -10) hasLeft = true;
                if (extent.xMax > 10) hasRight = true;
            }
            if (wall.size.x > wall.size.z && wall.size.x > 20) {
                if (extent.zMin < -10) hasFront = true;
                if (extent.zMax > 10) hasBack = true;
            }
        });

        return hasLeft && hasRight && hasFront && hasBack;
    }

    checkContainment(level) {
        // Find the play area bounds by identifying boundary walls
        let leftWall = null, rightWall = null, frontWall = null, backWall = null;

        level.walls.forEach(wall => {
            if (!wall.position || !wall.size) return;
            
            // Identify boundary walls (long walls parallel to an axis)
            if (wall.size.z > 20 && wall.size.z > wall.size.x * 3) {
                // This is a vertical boundary wall (runs along Z axis)
                if (wall.position.x < 0 && (!leftWall || wall.position.x < leftWall.x)) {
                    leftWall = { x: wall.position.x + wall.size.x / 2 }; // Inner edge
                }
                if (wall.position.x > 0 && (!rightWall || wall.position.x > rightWall.x)) {
                    rightWall = { x: wall.position.x - wall.size.x / 2 }; // Inner edge
                }
            }
            if (wall.size.x > 20 && wall.size.x > wall.size.z * 3) {
                // This is a horizontal boundary wall (runs along X axis)
                if (wall.position.z < 0 && (!frontWall || wall.position.z < frontWall.z)) {
                    frontWall = { z: wall.position.z + wall.size.z / 2 }; // Inner edge
                }
                if (wall.position.z > 0 && (!backWall || wall.position.z > backWall.z)) {
                    backWall = { z: wall.position.z - wall.size.z / 2 }; // Inner edge
                }
            }
        });

        // If we can't identify clear boundaries, don't error
        if (!leftWall || !rightWall || !frontWall || !backWall) {
            return { startInside: true, holeInside: true };
        }

        const minX = leftWall.x;
        const maxX = rightWall.x;
        const minZ = frontWall.z;
        const maxZ = backWall.z;

        const startInside = level.startPoint.x > minX && level.startPoint.x < maxX &&
                           level.startPoint.z > minZ && level.startPoint.z < maxZ;
        
        const holeInside = level.hole.x > minX && level.hole.x < maxX &&
                          level.hole.z > minZ && level.hole.z < maxZ;

        return { startInside, holeInside };
    }

    checkOverlaps(level, levelNumber) {
        const objects = [];
        
        // Collect all objects with positions
        ['walls', 'ramps', 'bumpers', 'bouncePads', 'fans'].forEach(type => {
            if (level[type] && Array.isArray(level[type])) {
                level[type].forEach((obj, idx) => {
                    if (obj.position) {
                        objects.push({ type, index: idx, ...obj });
                    }
                });
            }
        });

        // Check for objects too close to each other
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const dist = this.calculateDistance(objects[i].position, objects[j].position);
                if (dist < 1.5) {
                    this.warnings.push(`Level ${levelNumber}: ${objects[i].type}[${objects[i].index}] and ${objects[j].type}[${objects[j].index}] are very close (${dist.toFixed(1)} units)`);
                }
            }
        }
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = (pos1.y || 0) - (pos2.y || 0);
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    validateSettings(settings) {
        if (!settings) {
            this.warnings.push('No settings object found');
            return;
        }

        if (settings.gravity === undefined) {
            this.warnings.push('Missing gravity setting (default: -30)');
        } else if (settings.gravity > -10 || settings.gravity < -50) {
            this.warnings.push(`Unusual gravity value: ${settings.gravity} (typical: -30)`);
        }

        if (!settings.skyColor) {
            this.warnings.push('Missing skyColor setting');
        }

        if (!settings.groundColor) {
            this.warnings.push('Missing groundColor setting');
        }
    }
}

// CLI Usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node validate-map.js <path-to-map.json>');
        console.log('Example: node validate-map.js maps/MyLevel.json');
        process.exit(1);
    }

    const mapPath = args[0];
    
    try {
        const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        const validator = new MapValidator();
        const result = validator.validate(mapData);

        console.log('\n' + '='.repeat(60));
        console.log('VALIDATION RESULTS');
        console.log('='.repeat(60));

        if (result.errors.length === 0) {
            console.log('\n✅ No critical errors found!');
        } else {
            console.log('\n❌ ERRORS:');
            result.errors.forEach(err => console.log(`   - ${err}`));
        }

        if (result.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            result.warnings.forEach(warn => console.log(`   - ${warn}`));
        } else {
            console.log('\n✅ No warnings!');
        }

        console.log('\n' + '='.repeat(60));
        
        if (result.valid) {
            console.log('✅ Map is valid and ready to use!\n');
            process.exit(0);
        } else {
            console.log('❌ Map has critical errors that must be fixed.\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error reading or parsing map file:', error.message);
        process.exit(1);
    }
}

module.exports = MapValidator;
