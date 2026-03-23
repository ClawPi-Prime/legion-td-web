// Legion TD Web — Game Balance Config
// All balance numbers live here. Edit freely; no rebuild needed.
window.GAME_CONFIG = {

  races: {
    human: {
      name: 'Human Alliance',
      icon: '⚔️',
      description: 'Versatile human forces — mix melee, archers, support and siege for a balanced defence.',
      units: {
        footman: {
          label: 'Footman',
          icon: '🗡️',
          description: 'Sturdy melee fighter with natural armor.',
          cost: 15,
          hp: 120,
          dmg: 12,
          armor: 2,
          range: 1.2,
          atkSpeed: 0.9,
          moveSpeed: 2.0,
          color: '#5b8dd9',
          special: null,
        },
        archer: {
          label: 'Archer',
          icon: '🏹',
          description: 'Fast-attacking ranged unit. Low HP, no armor.',
          cost: 10,
          hp: 55,
          dmg: 11,
          armor: 0,
          range: 3.5,
          atkSpeed: 1.2,
          moveSpeed: 2.2,
          color: '#4CAF50',
          special: null,
        },
        knight: {
          label: 'Mounted Knight',
          icon: '🐴',
          description: 'Heavy cavalry. Periodic charge deals bonus damage and knocks enemies back toward spawn.',
          cost: 30,
          hp: 220,
          dmg: 18,
          armor: 4,
          range: 1.2,
          atkSpeed: 0.7,
          moveSpeed: 2.5,
          color: '#2196F3',
          special: 'charge',
          chargeCooldownMax: 8,   // seconds between charges
          chargeMultiplier: 2.5,  // damage multiplier on charge attack
          knockbackTiles: 2,      // tiles pushed back toward spawn
        },
        medic: {
          label: 'Field Medic',
          icon: '⚕️',
          description: 'No attack. Auto-heals the lowest-HP% ally within range. Cannot self-heal.',
          cost: 25,
          hp: 70,
          dmg: 0,
          armor: 0,
          range: 3.0,       // heal range (tiles)
          atkSpeed: 0,
          moveSpeed: 1.8,
          color: '#a8e6cf',
          special: 'heal',
          healPerSecond: 25, // HP healed per second
        },
        catapult: {
          label: 'Catapult',
          icon: '💣',
          description: 'Very slow but long-range siege weapon. Hits splash all nearby enemies.',
          cost: 60,
          hp: 130,
          dmg: 65,
          armor: 1,
          range: 4.5,
          atkSpeed: 0.25,
          moveSpeed: 1.0,
          color: '#FF5722',
          special: 'splash',
          splashRadius: 1.5,    // tiles around impact point
          splashDmgRatio: 0.5,  // fraction of base dmg dealt to splash targets
        },
        priest: {
          label: 'Priest',
          icon: '✝️',
          description: 'No attack. Passive aura boosts all nearby allies\' armor and damage. Stacks with multiple Priests.',
          cost: 35,
          hp: 80,
          dmg: 0,
          armor: 0,
          range: 3.5,       // used for hover preview (= auraRange)
          atkSpeed: 0,
          moveSpeed: 1.5,
          color: '#ffd700',
          special: 'aura',
          auraRange: 4.0,   // tiles
          auraArmor: 3,     // flat armor added to allies
          auraDmg: 8,       // flat damage added to allies
        },
      }
    }
    // Future races can be added here: orc, undead, elf, etc.
  },

  // Wave scaling
  waves: {
    baseCount: 8,        // enemies on wave 1
    countPerWave: 3,     // extra enemies each wave
    baseHp: 30,          // enemy HP on wave 1
    hpGrowthFactor: 1.2, // multiplied each wave
    baseSpeed: 0.6,      // base move speed multiplier (× TILE)
    speedPerWave: 0.05,  // speed added each wave
  },

  // Economy
  economy: {
    startGold: 50,
    killGold: 2,
    waveCompleteBase: 10,    // gold on wave complete
    waveCompleteCleanBonus: 5, // bonus if no leaks
  },

  // King
  king: {
    hp: 100,
    atkDmg: 18,
    atkCooldown: 2.0,
    atkRange: 1.1,  // in KT units
  },
};
