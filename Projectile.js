export default class Projectile {
    constructor(x, y, speedY, color, radius, damage) {
        this.x = x;
        this.y = y;
        this.speedY = speedY;
        this.speedX = 0;
        this.color = color;
        this.radius = radius;
        this.damage = damage;
    }

    update(deltaTime) {
        this.x += this.speedX * deltaTime;
        this.y += this.speedY * deltaTime;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        // Rectangular laser look
        ctx.fillRect(this.x - 2, this.y - 10, 4, 20);
        ctx.restore();
    }
}
