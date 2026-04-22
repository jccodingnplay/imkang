export default class PowerUp {
    constructor(engine, x, y, type) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.x = x;
        this.y = y;
        this.type = type; // 'multishot', 'shield', 'health'
        this.radius = 15;
        this.speed = 0.1;
        
        this.colors = {
            multishot: '#00f2ff',
            shield: '#7000ff',
            health: '#00ff77'
        };
        this.color = this.colors[type];
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime;
        
        // Floating animation
        this.x += Math.sin(Date.now() / 200) * 0.5;
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.color;
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = 2;

        // Diamond shape
        this.ctx.beginPath();
        this.ctx.moveTo(0, -this.radius);
        this.ctx.lineTo(this.radius, 0);
        this.ctx.lineTo(0, this.radius);
        this.ctx.lineTo(-this.radius, 0);
        this.ctx.closePath();
        this.ctx.stroke();

        // Icon/Letter
        this.ctx.fillStyle = this.color;
        this.ctx.font = 'bold 12px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const label = this.type === 'multishot' ? 'M' : this.type === 'shield' ? 'S' : 'H';
        this.ctx.fillText(label, 0, 0);

        this.ctx.restore();
    }
}
