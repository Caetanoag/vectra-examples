import { CanvasRenderer, Color, InputManager, Rect, Vector2, } from "../lib/index.js";
class Boid {
    position;
    velocity;
    acceleration;
    COLOR;
    static RADIUS = 10;
    static MOUSE_FEAR_RADIUS = Boid.RADIUS * 10;
    constructor(position, velocity = new Vector2(1, 1), acceleration = new Vector2(0, 0)) {
        this.position = position;
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.COLOR = new Color(Math.random(), Math.random(), Math.random());
    }
    separation(others, radius) {
        let force = new Vector2(0, 0);
        let count = 0;
        for (const other of others) {
            if (other === this)
                continue;
            const away = this.position.subtract(other.position);
            const dist = away.length;
            if (dist < radius && dist > 1e-6) {
                force = force.add(away.normalized().scale(1 - dist / radius));
                count++;
            }
        }
        return count > 0 ? force.scale(1 / count) : new Vector2(0, 0);
    }
    alignment(others, radius) {
        let avg = new Vector2(0, 0);
        let count = 0;
        for (const other of others) {
            if (other === this)
                continue;
            if (this.position.distanceTo(other.position) < radius) {
                avg = avg.add(other.velocity.normalized());
                count++;
            }
        }
        return count > 0 ? avg.normalized() : new Vector2(0, 0);
    }
    cohesion(others, radius) {
        let center = new Vector2(0, 0);
        let count = 0;
        for (const other of others) {
            if (other === this)
                continue;
            if (this.position.distanceTo(other.position) < radius) {
                center = center.add(other.position);
                count++;
            }
        }
        if (count === 0)
            return new Vector2(0, 0);
        return center
            .scale(1 / count)
            .subtract(this.position)
            .normalized();
    }
    steerFromFlock(others, dt) {
        const sep = this.separation(others, 90).scale(3);
        const ali = this.alignment(others, 100).scale(1.0);
        const coh = this.cohesion(others, 100).scale(0.8);
        const dir = sep.add(ali).add(coh);
        if (dir.length < 1e-6)
            return;
        if (this.velocity.length < 1e-6) {
            this.velocity = dir.normalized().scale(200);
            return;
        }
        const t = 1 - Math.exp(-4 * dt);
        let delta = dir.angle - this.velocity.angle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.velocity = this.velocity.rotate(delta * t);
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
        const t = 1 - Math.exp(-rate * dt);
        const current = this.velocity.angle;
        const target = dir.angle;
        let delta = target - current;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.velocity = this.velocity.rotate(delta * t);
    }
    bounceFromWalls(dt, box) {
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
        return { v, p };
    }
    steerAwayFromMouse(mouse, rate, dt) {
        const away = this.position.subtract(mouse);
        const distance = away.length;
        if (distance >= Boid.MOUSE_FEAR_RADIUS || distance < 1e-6)
            return;
        if (this.velocity.length < 1e-6) {
            this.velocity = away.normalized().scale(200);
            return;
        }
        const t = 1 - Math.exp(-rate * dt);
        let delta = away.angle - this.velocity.angle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.velocity = this.velocity.rotate(delta * t);
    }
    update(dt, box, mouse, boids) {
        this.velocity = this.velocity.add(this.acceleration.scale(dt));
        this.steerFromFlock(boids, dt);
        this.steerAwayFromMouse(mouse, 8, dt);
        this.steerAwayFromWalls(box, 200, 8, dt);
        const { v, p } = this.bounceFromWalls(dt, box);
        this.velocity = v;
        this.position = p;
        this.acceleration = new Vector2(0, 0);
    }
    draw(renderer) {
        const r = Boid.RADIUS;
        const angle = this.velocity.normalized().angle;
        const tip = this.position.add(new Vector2(r, 0).rotate(angle));
        const bottomLeft = this.position.add(new Vector2(-r, -r).rotate(angle));
        const bottomRight = this.position.add(new Vector2(-r, r).rotate(angle));
        renderer.fillPolygon([tip, bottomLeft, bottomRight], this.COLOR);
    }
}
const canvas = document.querySelector("canvas");
const renderer = new CanvasRenderer(canvas);
const input = new InputManager(canvas);
renderer.setSize(window.innerWidth, window.innerHeight);
const randomVelocity = () => {
    const minSpeed = renderer.width * 0.15;
    const maxSpeed = renderer.width * 0.35;
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(speed, 0).rotate(angle);
};
const randomPosition = () => {
    return new Vector2(renderer.width * Math.random(), renderer.height * Math.random());
};
const boids = [];
for (let i = 0; i < 100; i++) {
    boids.push(new Boid(randomPosition(), randomVelocity()));
}
let last = performance.now();
function loop() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    const mousePosition = input.getMousePosition();
    last = now;
    renderer.fillRect(renderer.boundingRect, Color.fromHex("#242b32").withAlpha(0.3));
    renderer.fillRect(Rect.fromCenter(mousePosition, new Vector2(Boid.MOUSE_FEAR_RADIUS * 0.2, Boid.MOUSE_FEAR_RADIUS * 0.2)), Color.green());
    boids.forEach((boid) => {
        boid.update(dt, renderer.boundingRect, mousePosition, boids);
    });
    boids.forEach((boid) => {
        boid.draw(renderer);
    });
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
