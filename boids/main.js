import { CanvasRenderer, Color, Vector2 } from "../lib/index.js";
class Boid {
    position;
    velocity;
    acceleration;
    static COLOR = Color.black();
    static RADIUS = 10;
    constructor(position, velocity = new Vector2(1, 1), acceleration = new Vector2(0, 0)) {
        this.position = position;
        this.velocity = velocity;
        this.acceleration = acceleration;
    }
    steerAwayFromWalls(box, margin, rate, dt) {
        let dir = new Vector2(0, 0);
        if (this.position.x < box.left + margin)
            dir = dir.add(new Vector2(1, 0));
        else if (this.position.x > box.right - margin)
            dir = dir.add(new Vector2(-1, 0));
        if (this.position.y < box.top + margin)
            dir = dir.add(new Vector2(0, 1));
        else if (this.position.y > box.bottom - margin)
            dir = dir.add(new Vector2(0, -1));
        if (dir.length < 1e-6)
            return;
        if (this.velocity.length < 1e-6) {
            this.velocity = dir.normalized().scale(200);
            return;
        }
        // fator independente de frame rate
        const t = 1 - Math.exp(-rate * dt);
        const current = this.velocity.angle;
        const target = dir.angle;
        let delta = target - current;
        // normaliza pra [-π, π] — gira pelo caminho curto
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.velocity = this.velocity.rotate(delta * t);
    }
    update(dt, box) {
        this.velocity = this.velocity.add(this.acceleration.scale(dt));
        let p = this.position.add(this.velocity.scale(dt));
        let v = this.velocity;
        if (p.x < box.left || p.x > box.right) {
            v = new Vector2(-v.x, v.y);
            p = new Vector2(Math.max(box.left, Math.min(box.right, p.x)), p.y);
        }
        if (p.y < box.top || p.y > box.bottom) {
            v = new Vector2(v.x, -v.y);
            p = new Vector2(p.x, Math.max(box.top, Math.min(box.bottom, p.y)));
        }
        this.velocity = v;
        this.position = p;
        this.steerAwayFromWalls(box, 200, 8, dt);
        this.acceleration = new Vector2(0, 0);
    }
    draw(renderer) {
        const r = Boid.RADIUS;
        const angle = this.velocity.normalized().angle;
        const tip = this.position.add(new Vector2(r, 0).rotate(angle));
        const bottomLeft = this.position.add(new Vector2(-r, -r).rotate(angle));
        const bottomRight = this.position.add(new Vector2(-r, r).rotate(angle));
        renderer.fillPolygon([tip, bottomLeft, bottomRight], Boid.COLOR);
    }
}
const canvas = document.querySelector("canvas");
const renderer = new CanvasRenderer(canvas);
renderer.setSize(window.innerWidth, window.innerHeight);
const boid = new Boid(renderer.boundingRect.center, new Vector2(0.5, 1.2).scale(renderer.width));
const dt = 1 / 60;
function loop() {
    renderer.clear();
    boid.draw(renderer);
    boid.update(dt, renderer.boundingRect);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
