import Projectile from './Projectile.js';
import PowerUp from './PowerUp.js';

// Enemy Class
export default class Enemy {
    constructor(engine, x, y, type = 'scout') {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === 'heavy') {
            this.health = 60;
            this.speed = 0.1;
            this.radius = 25;
            this.color = '#ff0055';
            this.scoreValue = 500;
            this.shootInterval = 2000;
        } else {
            this.health = 20;
            this.speed = 0.15;
            this.radius = 15;
            this.color = '#ffaa00';
            this.scoreValue = 100;
            this.shootInterval = 3000;
        }

        this.shootTimer = Math.random() * this.shootInterval;
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime;

        // Enemy shooting
        this.shootTimer += deltaTime;
        if (this.shootTimer > this.shootInterval && this.y > 0) {
            this.shoot();
            this.shootTimer = 0;
        }
    }

    shoot() {
        const p = new Projectile(this.x, this.y + 10, 0.4, this.color, 8, 10);
        this.engine.entities.enemyProjectiles.push(p);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.destroy(true);
        }
    }

    destroy(killedByPlayer) {
        if (killedByPlayer) {
            this.engine.score += this.scoreValue;
            this.engine.particleSystem.createExplosion(this.x, this.y, this.color, 15);
            
            // Random PowerUp drop
            if (Math.random() < 0.2) { // 20% drop rate
                const types = ['multishot', 'shield', 'health'];
                const type = types[Math.floor(Math.random() * types.length)];
                this.engine.entities.powerUps.push(new PowerUp(this.engine, this.x, this.y, type));
            }
        }
        this.health = 0; // Mark for removal
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        
        // Slight rotation for variety
        if (this.type === 'heavy') {
            this.ctx.rotate(Date.now() / 1000);
        }

        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.color;
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = 2;

        if (this.type === 'heavy') {
            // Hexagon shape
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i;
                const px = Math.cos(angle) * this.radius;
                const py = Math.sin(angle) * this.radius;
                if (i === 0) this.ctx.moveTo(px, py);
                else this.ctx.lineTo(px, py);
            }
            this.ctx.closePath();
            this.ctx.stroke();
            
            // Core
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            // V-Shape
            this.ctx.beginPath();
            this.ctx.moveTo(0, 15);
            this.ctx.lineTo(15, -10);
            this.ctx.lineTo(0, -5);
            this.ctx.lineTo(-15, -10);
            this.ctx.closePath();
            this.ctx.stroke();
        }

        this.ctx.restore();
    }
}
