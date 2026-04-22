import Player from './Player.js';
import Enemy from './Enemy.js';
import ParticleSystem from './ParticleSystem.js';
import PowerUp from './PowerUp.js';
import SoundManager from './SoundManager.js';

// ── Level thresholds (score needed to reach each level) ──────────────────
const LEVEL_THRESHOLDS = [0, 0, 800, 2000, 4000, 7000, 11000, 16000, 22000, 29000, 38000];

export default class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.width  = 0;
        this.height = 0;
        this.resize();

        this.sound = new SoundManager();

        this.entities = {
            player:            null,
            playerProjectiles: [],
            enemies:           [],
            enemyProjectiles:  [],
            powerUps:          [],
        };

        this.score       = 0;
        this.level       = 1;
        this.gameState   = 'menu';
        this.screenshake = 0;
        this.particleSystem = new ParticleSystem(this.ctx);

        this.lastTime      = 0;
        this.spawnTimer    = 0;
        this.spawnInterval = 1500;

        // Level-up notification
        this.levelUpTimer    = 0;
        this.levelUpLabel    = '';

        // Mobile / virtual joystick state
        this.virtualJoystick = { dx: 0, dy: 0, active: false, id: null, startX: 0, startY: 0 };
        this.touchFire       = false;
        this.touchFireId     = null;

        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initTouchControls();
        this.animate(0);
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.width  = parent ? parent.clientWidth  : window.innerWidth;
        this.height = parent ? parent.clientHeight : window.innerHeight;
        this.canvas.width  = this.width;
        this.canvas.height = this.height;
    }

    initInput() {
        this.keys = {};
        const block = ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
        window.addEventListener('keydown', e => {
            if (block.includes(e.code)) e.preventDefault();
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    }

    initTouchControls() {
        const canvas = this.canvas;

        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.sound.resume();
            Array.from(e.changedTouches).forEach(t => {
                if (t.clientX < this.width * 0.5) {
                    // Left side = joystick
                    if (!this.virtualJoystick.active) {
                        this.virtualJoystick.active = true;
                        this.virtualJoystick.id     = t.identifier;
                        this.virtualJoystick.startX = t.clientX;
                        this.virtualJoystick.startY = t.clientY;
                        this.virtualJoystick.dx     = 0;
                        this.virtualJoystick.dy     = 0;
                    }
                } else {
                    // Right side = fire
                    if (!this.touchFireId) {
                        this.touchFire   = true;
                        this.touchFireId = t.identifier;
                    }
                }
            });
        }, { passive: false });

        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            Array.from(e.changedTouches).forEach(t => {
                if (t.identifier === this.virtualJoystick.id) {
                    const dx = t.clientX - this.virtualJoystick.startX;
                    const dy = t.clientY - this.virtualJoystick.startY;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const maxDist = 50;
                    if (dist > 0) {
                        const norm = Math.min(dist, maxDist) / maxDist;
                        this.virtualJoystick.dx = (dx / dist) * norm;
                        this.virtualJoystick.dy = (dy / dist) * norm;
                    }
                }
            });
        }, { passive: false });

        canvas.addEventListener('touchend', e => {
            e.preventDefault();
            Array.from(e.changedTouches).forEach(t => {
                if (t.identifier === this.virtualJoystick.id) {
                    this.virtualJoystick.active = false;
                    this.virtualJoystick.id     = null;
                    this.virtualJoystick.dx     = 0;
                    this.virtualJoystick.dy     = 0;
                }
                if (t.identifier === this.touchFireId) {
                    this.touchFire   = false;
                    this.touchFireId = null;
                }
            });
        }, { passive: false });
    }

    start() {
        this.score         = 0;
        this.level         = 1;
        this.gameState     = 'playing';
        this.spawnInterval = 1500;
        this.screenshake   = 0;
        this.spawnTimer    = 0;
        this.levelUpTimer  = 0;
        this.lastTime      = performance.now();

        this.entities.player            = new Player(this);
        this.entities.enemies           = [];
        this.entities.playerProjectiles = [];
        this.entities.enemyProjectiles  = [];
        this.entities.powerUps          = [];

        this.updateHUD();
        this.sound.resume();
    }

    // ── Level-up check ────────────────────────────────────────────────────
    checkLevelUp() {
        const nextLevel = this.level + 1;
        const threshold = LEVEL_THRESHOLDS[Math.min(nextLevel, LEVEL_THRESHOLDS.length - 1)];
        if (this.score >= threshold && nextLevel > this.level) {
            this.level = nextLevel;
            this.onLevelUp();
        }
    }

    onLevelUp() {
        this.sound.playLevelUp();
        this.screenshake = 10;

        // Make enemies faster / tougher
        this.spawnInterval = Math.max(350, this.spawnInterval - 80);

        // Apply permanent upgrade to player
        const upgrades = [null, null,
            { label: '🔥 발사 속도 UP!',   apply: p => { p.shootInterval = Math.max(80, p.shootInterval - 40); } },
            { label: '💨 이동 속도 UP!',    apply: p => { p.speed += 0.08; } },
            { label: '🔫 멀티샷 해제!',     apply: p => { p.permanentMultishot = true; } },
            { label: '❤️ 최대 체력 UP!',    apply: p => { p.maxHealth += 30; p.health = Math.min(p.health + 30, p.maxHealth); } },
            { label: '🔥 발사 속도 UP!',   apply: p => { p.shootInterval = Math.max(60, p.shootInterval - 30); } },
            { label: '💥 데미지 UP!',       apply: p => { p.damage += 10; } },
            { label: '💨 이동 속도 UP!',    apply: p => { p.speed += 0.06; } },
            { label: '🌟 5연사 해제!',      apply: p => { p.permanentFiveShot = true; } },
            { label: '❤️ 최대 체력 UP!',    apply: p => { p.maxHealth += 50; p.health = Math.min(p.health + 50, p.maxHealth); } },
        ];

        const idx = Math.min(this.level, upgrades.length - 1);
        const upg = upgrades[idx] || upgrades[upgrades.length - 1];

        if (upg && this.entities.player) {
            upg.apply(this.entities.player);
            this.levelUpLabel = upg.label;
        } else {
            this.levelUpLabel = '⚡ 파워 UP!';
        }
        this.levelUpTimer = 2500; // show for 2.5s

        // Update HUD level badge
        const lvlEl = document.getElementById('level-value');
        if (lvlEl) lvlEl.textContent = `LV ${this.level}`;
    }

    gameOver() {
        this.gameState = 'gameover';
        window.dispatchEvent(new CustomEvent('gameover', { detail: { score: this.score } }));
    }

    updateHUD() {
        const sc = document.getElementById('score-value');
        if (sc) sc.textContent = this.score.toString().padStart(6, '0');

        const hp = document.getElementById('health-bar-fill');
        if (hp && this.entities.player) {
            const pct = (this.entities.player.health / this.entities.player.maxHealth) * 100;
            hp.style.width = `${Math.max(0, pct)}%`;
        }

        const lvlEl = document.getElementById('level-value');
        if (lvlEl) lvlEl.textContent = `LV ${this.level}`;
    }

    spawnEnemy() {
        const x    = Math.random() * (this.width - 40) + 20;
        // Higher levels = more heavy enemies
        const heavyChance = 0.1 + this.level * 0.05;
        const type = Math.random() < heavyChance ? 'heavy' : 'scout';
        const speedMult = 1 + (this.level - 1) * 0.1;
        this.entities.enemies.push(new Enemy(this, x, -50, type, speedMult));
    }

    checkCollisions() {
        // Player bullets vs Enemies
        for (const p of this.entities.playerProjectiles) {
            if (p.toRemove) continue;
            for (const e of this.entities.enemies) {
                if (e.health <= 0) continue;
                const dx = p.x - e.x, dy = p.y - e.y;
                if (Math.sqrt(dx*dx + dy*dy) < p.radius + e.radius) {
                    e.takeDamage(p.damage);
                    p.toRemove = true;
                    this.particleSystem.createExplosion(p.x, p.y, '#00f2ff', 5);
                    break;
                }
            }
        }

        // Power-ups vs Player
        if (this.entities.player) {
            for (const pu of this.entities.powerUps) {
                if (pu.toRemove) continue;
                const dx = pu.x - this.entities.player.x, dy = pu.y - this.entities.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < pu.radius + this.entities.player.radius) {
                    this.entities.player.applyPowerUp(pu.type);
                    pu.toRemove = true;
                    this.particleSystem.createExplosion(pu.x, pu.y, pu.color, 10);
                }
            }
        }

        // Enemies vs Player
        if (this.entities.player) {
            for (const e of this.entities.enemies) {
                if (e.health <= 0) continue;
                const dx = e.x - this.entities.player.x, dy = e.y - this.entities.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < e.radius + this.entities.player.radius) {
                    this.entities.player.takeDamage(20);
                    e.destroy(false);
                }
            }
        }

        // Enemy bullets vs Player
        if (this.entities.player) {
            for (const p of this.entities.enemyProjectiles) {
                if (p.toRemove) continue;
                const dx = p.x - this.entities.player.x, dy = p.y - this.entities.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < p.radius + this.entities.player.radius) {
                    this.entities.player.takeDamage(p.damage);
                    p.toRemove = true;
                    this.particleSystem.createExplosion(p.x, p.y, '#ff0055', 5);
                }
            }
        }
    }

    // ── Draw level-up banner ─────────────────────────────────────────────
    drawLevelUpBanner(deltaTime) {
        if (this.levelUpTimer <= 0) return;
        this.levelUpTimer -= deltaTime;
        const alpha = Math.min(1, this.levelUpTimer / 500);

        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        // Background pill
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.ctx.beginPath();
        this.ctx.roundRect(this.width/2 - 160, this.height/2 - 50, 320, 90, 12);
        this.ctx.fill();

        // Border glow
        this.ctx.shadowBlur  = 20;
        this.ctx.shadowColor = '#00f2ff';
        this.ctx.strokeStyle = '#00f2ff';
        this.ctx.lineWidth   = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(this.width/2 - 160, this.height/2 - 50, 320, 90, 12);
        this.ctx.stroke();

        // Text
        this.ctx.shadowBlur  = 10;
        this.ctx.fillStyle   = '#00f2ff';
        this.ctx.font        = 'bold 22px Orbitron, sans-serif';
        this.ctx.textAlign   = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`LEVEL ${this.level} UP!`, this.width/2, this.height/2 - 18);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font      = 'bold 16px Inter, sans-serif';
        this.ctx.fillText(this.levelUpLabel, this.width/2, this.height/2 + 14);

        this.ctx.restore();
    }

    // ── Draw virtual joystick ────────────────────────────────────────────
    drawVirtualControls() {
        const vj = this.virtualJoystick;
        const cx = this.width * 0.18;
        const cy = this.height - 90;
        const outerR = 45;
        const innerR = 18;

        this.ctx.save();
        this.ctx.globalAlpha = 0.35;

        // Outer ring
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#00f2ff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Inner knob
        const kx = cx + vj.dx * outerR;
        const ky = cy + vj.dy * outerR;
        this.ctx.beginPath();
        this.ctx.arc(kx, ky, innerR, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00f2ff';
        this.ctx.fill();

        // Fire button
        const fx = this.width * 0.82;
        const fy = this.height - 90;
        this.ctx.beginPath();
        this.ctx.arc(fx, fy, 38, 0, Math.PI * 2);
        this.ctx.fillStyle = this.touchFire ? '#ff0055' : 'rgba(255,0,85,0.5)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ff0055';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.globalAlpha = 0.9;
        this.ctx.fillStyle   = '#fff';
        this.ctx.font        = 'bold 13px Orbitron, sans-serif';
        this.ctx.textAlign   = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('FIRE', fx, fy);

        this.ctx.restore();
    }

    animate(timeStamp) {
        if (!this.lastTime) this.lastTime = timeStamp;
        const deltaTime = Math.min(timeStamp - this.lastTime, 100);
        this.lastTime = timeStamp;

        // Background trail
        this.ctx.fillStyle = 'rgba(5, 5, 10, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.drawStars(deltaTime);

        if (this.gameState === 'playing') {
            // Player
            if (this.entities.player) {
                this.entities.player.update(deltaTime);
                this.entities.player.draw();
            }

            // Spawn
            this.spawnTimer += deltaTime;
            if (this.spawnTimer > this.spawnInterval) {
                this.spawnEnemy();
                this.spawnTimer = 0;
            }

            // Player projectiles
            this.entities.playerProjectiles = this.entities.playerProjectiles.filter(p => {
                p.update(deltaTime);
                p.draw(this.ctx);
                return !p.toRemove && p.y > -60 && p.y < this.height + 60 && p.x > -60 && p.x < this.width + 60;
            });

            // Enemy projectiles
            this.entities.enemyProjectiles = this.entities.enemyProjectiles.filter(p => {
                p.update(deltaTime);
                p.draw(this.ctx);
                return !p.toRemove && p.y > -60 && p.y < this.height + 60;
            });

            // Enemies
            this.entities.enemies = this.entities.enemies.filter(e => {
                e.update(deltaTime);
                e.draw();
                return e.y < this.height + 100 && e.health > 0;
            });

            // Power-ups
            this.entities.powerUps = this.entities.powerUps.filter(pu => {
                pu.update(deltaTime);
                pu.draw();
                return !pu.toRemove && pu.y < this.height + 100;
            });

            this.checkCollisions();
            this.checkLevelUp();
            this.updateHUD();

            // Level-up banner
            this.drawLevelUpBanner(deltaTime);
        }

        this.particleSystem.update(deltaTime);

        // Screen shake
        if (this.screenshake > 0) {
            this.ctx.setTransform(1, 0, 0, 1,
                (Math.random() - 0.5) * this.screenshake,
                (Math.random() - 0.5) * this.screenshake);
            this.screenshake *= 0.88;
            if (this.screenshake < 0.5) { this.screenshake = 0; this.ctx.setTransform(1,0,0,1,0,0); }
        } else {
            this.ctx.setTransform(1,0,0,1,0,0);
        }

        // Mobile controls overlay
        this.drawVirtualControls();

        requestAnimationFrame(t => this.animate(t));
    }

    drawStars(deltaTime) {
        if (!this.stars) {
            this.stars = [];
            for (let i = 0; i < 120; i++) {
                this.stars.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 1.5 + 0.3,
                    speed: Math.random() * 0.08 + 0.02,
                    opacity: Math.random() * 0.7 + 0.3
                });
            }
        }
        this.stars.forEach(s => {
            s.y += s.speed * deltaTime;
            if (s.y > this.height) { s.y = 0; s.x = Math.random() * this.width; }
            this.ctx.globalAlpha = s.opacity;
            this.ctx.fillStyle   = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }
}
