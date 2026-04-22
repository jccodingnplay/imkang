import Projectile from './Projectile.js';

// ── Level-up upgrade definitions ──────────────────────────────────────────
const LEVEL_UPGRADES = [
    null, // level 0 placeholder
    null, // level 1 = starting state
    { label: '발사 속도 UP!',   apply: p => { p.shootInterval = Math.max(80, p.shootInterval - 40); } },
    { label: '이동 속도 UP!',   apply: p => { p.speed += 0.08; } },
    { label: '멀티샷 해제!',    apply: p => { p.permanentMultishot = true; } },
    { label: '체력 증가!',      apply: p => { p.maxHealth += 30; p.health = Math.min(p.health + 30, p.maxHealth); } },
    { label: '발사 속도 UP!',   apply: p => { p.shootInterval = Math.max(60, p.shootInterval - 30); } },
    { label: '데미지 UP!',      apply: p => { p.damage += 10; } },
    { label: '이동 속도 UP!',   apply: p => { p.speed += 0.06; } },
    { label: '5연사 해제!',     apply: p => { p.permanentFiveShot = true; } },
    { label: '최대 체력 UP!',   apply: p => { p.maxHealth += 50; p.health = Math.min(p.health + 50, p.maxHealth); } },
];

export default class Player {
    constructor(engine) {
        this.engine = engine;
        this.ctx   = engine.ctx;
        this.x     = engine.width / 2;
        this.y     = engine.height - 100;
        this.radius = 20;

        // ── Base stats (persist across level-ups) ──
        this.speed         = 0.4;
        this.health        = 100;
        this.maxHealth     = 100;
        this.shootInterval = 200;   // ms between shots
        this.damage        = 25;

        // ── Permanent ability flags ──
        this.permanentMultishot = false;
        this.permanentFiveShot  = false;

        // ── Temporary power-up timers ──
        this.tempShield    = 0;
        this.tempMultishot = 0;   // extra time bonus from item

        this.shootTimer = 0;
        this.color      = '#00f2ff';

        // Apply upgrades already earned this game session
        this._applyStoredUpgrades();
    }

    /** Re-apply all level upgrades earned so far so stats persist after reset */
    _applyStoredUpgrades() {
        const level = this.engine.level;
        for (let i = 2; i <= level; i++) {
            const upg = LEVEL_UPGRADES[i] || LEVEL_UPGRADES[LEVEL_UPGRADES.length - 1];
            if (upg) upg.apply(this);
        }
    }

    isMultiShot() {
        return this.permanentMultishot || this.permanentFiveShot || this.tempMultishot > 0;
    }

    update(deltaTime) {
        // ── Keyboard / virtual joystick movement ──
        const keys = this.engine.keys;
        const vj   = this.engine.virtualJoystick;

        let dx = 0, dy = 0;
        if (keys['ArrowLeft']  || keys['KeyA']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
        if (keys['ArrowUp']    || keys['KeyW']) dy -= 1;
        if (keys['ArrowDown']  || keys['KeyS']) dy += 1;

        // Virtual joystick (mobile)
        if (vj && (vj.dx !== 0 || vj.dy !== 0)) {
            dx += vj.dx;
            dy += vj.dy;
        }

        // Normalise diagonal movement
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

        this.x += dx * this.speed * deltaTime;
        this.y += dy * this.speed * deltaTime;

        // Clamp to canvas
        this.x = Math.max(this.radius, Math.min(this.engine.width  - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(this.engine.height - this.radius, this.y));

        // ── Shooting ──
        this.shootTimer += deltaTime;
        const wantShoot = keys['Space'] || keys['Enter'] || this.engine.touchFire;
        if (wantShoot && this.shootTimer > this.shootInterval) {
            this.shoot();
            this.shootTimer = 0;
        }

        // ── Temp timer countdown ──
        if (this.tempMultishot > 0) this.tempMultishot -= deltaTime;
        if (this.tempShield    > 0) this.tempShield    -= deltaTime;

        // ── Engine trail ──
        if (Math.random() > 0.5) {
            this.engine.particleSystem.createParticle(
                this.x, this.y + 20, '#7000ff',
                1 + Math.random() * 2,
                { x: (Math.random() - 0.5) * 0.1, y: 0.1 + Math.random() * 0.2 },
                500
            );
        }
    }

    shoot() {
        this.engine.sound.playShoot();

        if (this.permanentFiveShot) {
            [-24, -12, 0, 12, 24].forEach(ox => {
                this.engine.entities.playerProjectiles.push(
                    new Projectile(this.x + ox, this.y - 10, -0.8, this.color, 4, this.damage)
                );
            });
        } else if (this.isMultiShot()) {
            [-15, 0, 15].forEach(ox => {
                this.engine.entities.playerProjectiles.push(
                    new Projectile(this.x + ox, this.y - 10, -0.8, this.color, 4, this.damage)
                );
            });
        } else {
            this.engine.entities.playerProjectiles.push(
                new Projectile(this.x, this.y - 10, -0.8, this.color, 4, this.damage)
            );
        }
    }

    applyPowerUp(type) {
        this.engine.sound.playPowerUp();
        if (type === 'multishot') this.tempMultishot = 8000;
        if (type === 'shield')    this.tempShield    = 8000;
        if (type === 'health')    this.health = Math.min(this.maxHealth, this.health + 40);
    }

    takeDamage(amount) {
        if (this.tempShield > 0) {
            this.tempShield = 0;
            this.engine.particleSystem.createExplosion(this.x, this.y, '#7000ff', 10);
            return;
        }
        this.health -= amount;
        this.engine.screenshake = 15;
        this.engine.sound.playHit();
        this.engine.particleSystem.createExplosion(this.x, this.y, '#ffffff', 3);
        if (this.health <= 0) {
            this.engine.particleSystem.createExplosion(this.x, this.y, this.color, 25);
            this.engine.gameOver();
        }
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);

        this.ctx.shadowBlur  = 18;
        this.ctx.shadowColor = this.color;
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth   = 2;

        // Ship body
        this.ctx.beginPath();
        this.ctx.moveTo(0,   -22);
        this.ctx.lineTo(16,   16);
        this.ctx.lineTo(0,     8);
        this.ctx.lineTo(-16,  16);
        this.ctx.closePath();
        this.ctx.stroke();

        // Centre line detail
        this.ctx.beginPath();
        this.ctx.moveTo(0, -5);
        this.ctx.lineTo(0,  5);
        this.ctx.stroke();

        // Shield ring
        if (this.tempShield > 0) {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 32, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#7000ff';
            this.ctx.setLineDash([6, 4]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.ctx.restore();
    }
}
