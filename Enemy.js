import Projectile from './Projectile.js';
import PowerUp from './PowerUp.js';

export default class Enemy {
    constructor(engine, x, y, type = 'scout', speedMult = 1) {
        this.engine    = engine;
        this.ctx       = engine.ctx;
        this.x         = x;
        this.y         = y;
        this.type      = type;
        this.speedMult = speedMult;

        if (type === 'heavy') {
            this.health        = 60 + engine.level * 10;
            this.speed         = 0.10 * speedMult;
            this.radius        = 25;
            this.color         = '#ff0055';
            this.scoreValue    = 500;
            this.shootInterval = 2200;
        } else {
            this.health        = 20 + engine.level * 3;
            this.speed         = 0.15 * speedMult;
            this.radius        = 15;
            this.color         = '#ffaa00';
            this.scoreValue    = 100;
            this.shootInterval = 3200;
        }

        this.shootTimer = Math.random() * this.shootInterval;
        this.angle      = 0; // for heavy rotation
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime;
        this.angle += 0.001 * deltaTime;

        this.shootTimer += deltaTime;
        if (this.shootTimer > this.shootInterval && this.y > 0) {
            this.shoot();
            this.shootTimer = 0;
        }
    }

    shoot() {
        this.engine.entities.enemyProjectiles.push(
            new Projectile(this.x, this.y + 10, 0.4, this.color, 8, 10)
        );
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) this.destroy(true);
    }

    destroy(killedByPlayer) {
        if (killedByPlayer) {
            this.engine.score += this.scoreValue;
            this.engine.sound.playExplosion();
            this.engine.particleSystem.createExplosion(this.x, this.y, this.color, 15);

            // Power-up drop (higher chance at higher levels capped at 30%)
            const dropChance = Math.min(0.30, 0.15 + this.engine.level * 0.01);
            if (Math.random() < dropChance) {
                const types = ['multishot', 'shield', 'health'];
                const type  = types[Math.floor(Math.random() * types.length)];
                this.engine.entities.powerUps.push(new PowerUp(this.engine, this.x, this.y, type));
            }
        }
        this.health = 0;
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        if (this.type === 'heavy') this.ctx.rotate(this.angle);

        this.ctx.shadowBlur  = 15;
        this.ctx.shadowColor = this.color;
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth   = 2;

        if (this.type === 'heavy') {
            // Hexagon
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a  = (Math.PI * 2 / 6) * i;
                const px = Math.cos(a) * this.radius;
                const py = Math.sin(a) * this.radius;
                i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
            }
            this.ctx.closePath();
            this.ctx.stroke();
            // Core dot
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            // V-shape
            this.ctx.beginPath();
            this.ctx.moveTo(0,    15);
            this.ctx.lineTo(14, -10);
            this.ctx.lineTo(0,   -3);
            this.ctx.lineTo(-14, -10);
            this.ctx.closePath();
            this.ctx.stroke();
        }

        this.ctx.restore();
    }
}
