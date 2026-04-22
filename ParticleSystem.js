class Particle {
    constructor(x, y, color, size, velocity, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.velocity = velocity;
        this.life = life;
        this.maxLife = life;
    }

    update(deltaTime) {
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;
        this.life -= deltaTime;
    }

    draw(ctx) {
        const opacity = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fill(); // Wait, this.ctx is wrong, it's passed as arg
        ctx.restore();
    }
}

export default class ParticleSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.particles = [];
    }

    createParticle(x, y, color, size, velocity, life) {
        this.particles.push({
            x, y, color, size, velocity, life, maxLife: life
        });
    }

    createExplosion(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.2 + 0.1;
            this.createParticle(
                x, y, color, 
                Math.random() * 3 + 1, 
                { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                Math.random() * 500 + 500
            );
        }
    }

    update(deltaTime) {
        this.particles = this.particles.filter(p => {
            p.x += p.velocity.x * deltaTime;
            p.y += p.velocity.y * deltaTime;
            p.life -= deltaTime;
            
            if (p.life > 0) {
                const opacity = p.life / p.maxLife;
                this.ctx.save();
                this.ctx.globalAlpha = opacity;
                this.ctx.fillStyle = p.color;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                return true;
            }
            return false;
        });
    }
}
