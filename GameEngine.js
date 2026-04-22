import Player from './Player.js';
import Enemy from './Enemy.js';
import ParticleSystem from './ParticleSystem.js';
import PowerUp from './PowerUp.js';

export default class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.resize();

        this.entities = {
            player: null,
            playerProjectiles: [],
            enemies: [],
            enemyProjectiles: [],
            powerUps: [],
            particles: []
        };

        this.screenshake = 0;
        this.score = 0;
        this.gameState = 'menu'; // menu, playing, gameover
        this.particleSystem = new ParticleSystem(this.ctx);
        
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 1500;

        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.animate(0);
    }

    resize() {
        // Set internal resolution
        this.width = this.canvas.parentElement.clientWidth;
        this.height = this.canvas.parentElement.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initInput() {
        this.keys = {};
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    start() {
        this.score = 0;
        this.updateHUD();
        this.entities.player = new Player(this);
        this.entities.enemies = [];
        this.entities.playerProjectiles = [];
        this.entities.enemyProjectiles = [];
        this.entities.powerUps = [];
        this.entities.particles = [];
        this.gameState = 'playing';
        this.spawnInterval = 1500;
        this.screenshake = 0;
    }

    gameOver() {
        this.gameState = 'gameover';
        const event = new CustomEvent('gameover', { detail: { score: this.score } });
        window.dispatchEvent(event);
    }

    updateHUD() {
        const scoreEl = document.getElementById('score-value');
        if (scoreEl) scoreEl.textContent = this.score.toString().padStart(6, '0');
        
        const healthFill = document.getElementById('health-bar-fill');
        if (healthFill && this.entities.player) {
            const healthPct = (this.entities.player.health / this.entities.player.maxHealth) * 100;
            healthFill.style.width = `${Math.max(0, healthPct)}%`;
        }
    }

    spawnEnemy() {
        const x = Math.random() * (this.width - 40) + 20;
        const type = Math.random() > 0.8 ? 'heavy' : 'scout';
        this.entities.enemies.push(new Enemy(this, x, -50, type));
    }

    checkCollisions() {
        // Player Projectiles vs Enemies
        this.entities.playerProjectiles.forEach((p, pIdx) => {
            this.entities.enemies.forEach((e, eIdx) => {
                const dx = p.x - e.x;
                const dy = p.y - e.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < p.radius + e.radius) {
                    e.takeDamage(p.damage);
                    this.entities.playerProjectiles.splice(pIdx, 1);
                    this.particleSystem.createExplosion(p.x, p.y, '#00f2ff', 5);
                }
            });
        });

        // Player vs PowerUps
        this.entities.powerUps.forEach((pu, puIdx) => {
            if (!this.entities.player) return;
            const dx = pu.x - this.entities.player.x;
            const dy = pu.y - this.entities.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < pu.radius + this.entities.player.radius) {
                this.entities.player.applyPowerUp(pu.type);
                this.entities.powerUps.splice(puIdx, 1);
                this.particleSystem.createExplosion(pu.x, pu.y, pu.color, 10);
            }
        });

        // Enemies vs Player
        this.entities.enemies.forEach((e, eIdx) => {
            if (!this.entities.player) return;
            const dx = e.x - this.entities.player.x;
            const dy = e.y - this.entities.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < e.radius + this.entities.player.radius) {
                this.entities.player.takeDamage(20);
                e.destroy(false);
            }
        });

        // Enemy Projectiles vs Player
        this.entities.enemyProjectiles.forEach((p, pIdx) => {
            if (!this.entities.player) return;
            const dx = p.x - this.entities.player.x;
            const dy = p.y - this.entities.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < p.radius + this.entities.player.radius) {
                this.entities.player.takeDamage(p.damage);
                this.entities.enemyProjectiles.splice(pIdx, 1);
                this.particleSystem.createExplosion(p.x, p.y, '#ff0055', 5);
            }
        });
    }

    animate(timeStamp) {
        const deltaTime = timeStamp - this.lastTime;
        this.lastTime = timeStamp;

        // Clear canvas
        this.ctx.fillStyle = 'rgba(5, 5, 10, 0.3)'; // Trail effect
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Background Stars (simple)
        this.drawStars(deltaTime);

        if (this.gameState === 'playing') {
            // Update & Draw Player
            if (this.entities.player) {
                this.entities.player.update(deltaTime);
                this.entities.player.draw();
            }

            // Spawn Enemies
            this.spawnTimer += deltaTime;
            if (this.spawnTimer > this.spawnInterval) {
                this.spawnEnemy();
                this.spawnTimer = 0;
                // Slowly increase difficulty
                if (this.spawnInterval > 400) this.spawnInterval -= 5;
            }

            // Update & Draw Projectiles
            this.entities.playerProjectiles = this.entities.playerProjectiles.filter(p => {
                p.update(deltaTime);
                p.draw(this.ctx);
                return p.y > -50 && p.y < this.height + 50;
            });

            this.entities.enemyProjectiles = this.entities.enemyProjectiles.filter(p => {
                p.update(deltaTime);
                p.draw(this.ctx);
                return p.y > -50 && p.y < this.height + 50;
            });

            // Update & Draw Enemies
            this.entities.enemies = this.entities.enemies.filter(e => {
                e.update(deltaTime);
                e.draw();
                return e.y < this.height + 100 && e.health > 0;
            });

            // Update & Draw PowerUps
            this.entities.powerUps = this.entities.powerUps.filter(pu => {
                pu.update(deltaTime);
                pu.draw();
                return pu.y < this.height + 100;
            });

            this.checkCollisions();
            this.updateHUD();
        }

        // Update & Draw Particles
        this.particleSystem.update(deltaTime);

        if (this.screenshake > 0) {
            const sx = (Math.random() - 0.5) * this.screenshake;
            const sy = (Math.random() - 0.5) * this.screenshake;
            this.ctx.setTransform(1, 0, 0, 1, sx, sy);
            this.screenshake *= 0.9;
            if (this.screenshake < 0.1) {
                this.screenshake = 0;
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
        } else {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        requestAnimationFrame((t) => this.animate(t));
    }

    drawStars(deltaTime) {
        // Simple starfield implementation
        if (!this.stars) {
            this.stars = [];
            for (let i = 0; i < 100; i++) {
                this.stars.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 2,
                    speed: Math.random() * 0.05 + 0.02
                });
            }
        }

        this.ctx.fillStyle = 'white';
        this.stars.forEach(star => {
            star.y += star.speed * deltaTime;
            if (star.y > this.height) star.y = 0;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
}
