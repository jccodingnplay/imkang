import Projectile from './Projectile.js';

export default class Player {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.x = engine.width / 2;
        this.y = engine.height - 100;
        this.radius = 20;
        this.speed = 0.4;
        this.health = 100;
        this.maxHealth = 100;
        
        this.shootTimer = 0;
        this.shootInterval = 200;
        
        this.powerUps = {
            multishot: 0,
            shield: 0
        };

        this.color = '#00f2ff';
    }

    update(deltaTime) {
        // Movement
        if (this.engine.keys['ArrowLeft'] || this.engine.keys['KeyA']) {
            this.x -= this.speed * deltaTime;
        }
        if (this.engine.keys['ArrowRight'] || this.engine.keys['KeyD']) {
            this.x += this.speed * deltaTime;
        }
        if (this.engine.keys['ArrowUp'] || this.engine.keys['KeyW']) {
            this.y -= this.speed * deltaTime;
        }
        if (this.engine.keys['ArrowDown'] || this.engine.keys['KeyS']) {
            this.y += this.speed * deltaTime;
        }

        // Boundaries
        this.x = Math.max(this.radius, Math.min(this.engine.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(this.engine.height - this.radius, this.y));

        // Shooting
        this.shootTimer += deltaTime;
        if ((this.engine.keys['Space'] || this.engine.keys['Enter']) && this.shootTimer > this.shootInterval) {
            this.shoot();
            this.shootTimer = 0;
        }

        // Update power-up timers
        if (this.powerUps.multishot > 0) this.powerUps.multishot -= deltaTime;
        if (this.powerUps.shield > 0) this.powerUps.shield -= deltaTime;
        
        // Engine trails
        if (Math.random() > 0.5) {
            this.engine.particleSystem.createParticle(
                this.x, 
                this.y + 20, 
                '#7000ff', 
                1 + Math.random() * 2, 
                { x: (Math.random() - 0.5) * 0.1, y: 0.1 + Math.random() * 0.2 },
                500
            );
        }
    }

    shoot() {
        if (this.powerUps.multishot > 0) {
            const offsets = [-15, 0, 15];
            offsets.forEach(ox => {
                const p = new Projectile(this.x + ox, this.y - 10, -0.8, this.color, 4, 25);
                this.engine.entities.playerProjectiles.push(p);
            });
        } else {
            const p = new Projectile(this.x, this.y - 10, -0.8, this.color, 4, 25);
            this.engine.entities.playerProjectiles.push(p);
        }
    }

    applyPowerUp(type) {
        if (type === 'multishot') this.powerUps.multishot = 5000;
        if (type === 'shield') this.powerUps.shield = 5000;
        if (type === 'health') this.health = Math.min(this.maxHealth, this.health + 30);
    }

    takeDamage(amount) {
        if (this.powerUps.shield > 0) {
            this.powerUps.shield = 0; // Shield breaks on one hit for balance or just protects once
            this.engine.particleSystem.createExplosion(this.x, this.y, '#7000ff', 10);
            return;
        }
        this.health -= amount;
        this.engine.screenshake = 15;
        this.engine.particleSystem.createExplosion(this.x, this.y, '#ffffff', 3);
        if (this.health <= 0) {
            this.engine.particleSystem.createExplosion(this.x, this.y, this.color, 20);
            this.engine.gameOver();
        }
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);

        // Glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.color;

        // Ship Body (Modern Triangle/Diamond shape)
        this.ctx.beginPath();
        this.ctx.moveTo(0, -20); // Tip
        this.ctx.lineTo(15, 15); // Right bottom
        this.ctx.lineTo(0, 8);   // Back notch
        this.ctx.lineTo(-15, 15); // Left bottom
        this.ctx.closePath();

        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Shield Visual
        if (this.powerUps.shield > 0) {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#7000ff';
            this.ctx.setLineDash([5, 5]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Interior Detail
        this.ctx.beginPath();
        this.ctx.moveTo(0, -5);
        this.ctx.lineTo(0, 5);
        this.ctx.stroke();

        this.ctx.restore();
    }
}
