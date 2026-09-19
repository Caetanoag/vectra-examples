import { CanvasRenderer, Color, InputManager, Rect, Vector2, } from "../lib/index.js";
/** Height of the shared header (--vt-header-h token from index.html) so the canvas fits below it. */
const HEADER_HEIGHT = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--vt-header-h"), 10) || 0;
const canvas = document.querySelector("canvas");
const renderer = new CanvasRenderer(canvas);
const input = new InputManager(canvas);
renderer.setSize(window.innerWidth * 0.8, window.innerHeight * 0.8 - HEADER_HEIGHT);
const Config = {
    boid: {
        color_to_follow: -1,
        quantity: 150,
        radius: renderer.width * 0.005,
        wander: 0.005,
        get mouse_action_radius() {
            return this.radius * 10;
        },
        get predator_fear_radius() {
            return Config.predator.radius_ratio * this.radius * 10;
        },
        weights: {
            separation: 30,
            alignment: 10,
            cohesion: 8,
        },
    },
    predator: {
        radius_ratio: 2,
    },
};
class Boid {
    position;
    velocity;
    acceleration;
    color;
    radius;
    static DEFAULT_RADIUS = Config.boid.radius;
    static WANDER_STRENGTH = Config.boid.wander;
    static mouse_action_radius = Config.boid.mouse_action_radius;
    static PREDATOR_FEAR_RADIUS = Config.boid.predator_fear_radius;
    SPECIES;
    constructor(position, velocity = new Vector2(1, 1), acceleration = new Vector2(0, 0)) {
        this.position = position;
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.SPECIES = (Math.random() * 10) & 1;
        if (this.SPECIES === 1) {
            this.color = Color.fromRgb(100, 100, 255);
        }
        else {
            this.color = Color.fromRgb(100, 255, 100);
        }
        this.radius = Boid.DEFAULT_RADIUS;
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
            if (other.SPECIES !== this.SPECIES)
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
            if (other.SPECIES !== this.SPECIES)
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
        const sep = this.separation(others, 40).scale(Config.boid.weights.separation / 10);
        const ali = this.alignment(others, 80).scale(Config.boid.weights.alignment / 10);
        const coh = this.cohesion(others, 80).scale(Config.boid.weights.cohesion / 10);
        const wander = (Math.random() - 0.5) * Boid.WANDER_STRENGTH;
        const dir = sep.add(ali).add(coh).rotate(wander);
        if (dir.length < 1e-6) {
            this.velocity = this.velocity.rotate(wander);
            return;
        }
        if (this.velocity.length < 1e-6) {
            this.velocity = dir.normalized().scale(200);
            return;
        }
        const t = 1 - Math.exp(-4 * dt);
        let delta = dir.angle - this.velocity.angle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.velocity = this.velocity.rotate(delta * t);
    }
    steerAwayFromPoint(point, fearRadius, rate, dt) {
        const away = this.position.subtract(point);
        const distance = away.length;
        if (distance >= fearRadius || distance < 1e-6)
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
    steerTowardsPoint(point, attractRadius, rate, dt) {
        const towards = point.subtract(this.position);
        const distance = towards.length;
        if (distance >= attractRadius || distance < 1e-6)
            return;
        if (this.velocity.length < 1e-6) {
            this.velocity = towards.normalized().scale(200);
            return;
        }
        const t = 1 - Math.exp(-rate * dt);
        let delta = towards.angle - this.velocity.angle;
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
        const r = this.radius;
        let p = this.position.add(this.velocity.scale(dt));
        let v = this.velocity;
        if (p.x < box.left + r || p.x > box.right - r) {
            v = new Vector2(-v.x, v.y);
            p = new Vector2(Math.max(box.left + r, Math.min(box.right - r, p.x)), p.y);
        }
        if (p.y < box.top + r || p.y > box.bottom - r) {
            v = new Vector2(v.x, -v.y);
            p = new Vector2(p.x, Math.max(box.top + r, Math.min(box.bottom - r, p.y)));
        }
        return { v, p };
    }
    drawBody(renderer, position, angle, color) {
        const r = this.radius;
        const tip = position.add(new Vector2(r, 0).rotate(angle));
        const bottomLeft = position.add(new Vector2(-r, -r).rotate(angle));
        const bottomRight = position.add(new Vector2(-r, r).rotate(angle));
        renderer.fillPolygon([tip, bottomLeft, bottomRight], color);
    }
    update(dt, box, mouse, boids, predator) {
        this.velocity = this.velocity.add(this.acceleration.scale(dt));
        this.steerFromFlock(boids, dt);
        if (predator)
            this.steerAwayFromPoint(predator.position, Boid.PREDATOR_FEAR_RADIUS, 6, dt);
        if (Config.boid.color_to_follow !== this.SPECIES) {
            this.steerAwayFromPoint(mouse, Boid.mouse_action_radius, 8, dt);
        }
        else {
            this.steerTowardsPoint(mouse, Boid.mouse_action_radius, 8, dt);
        }
        this.steerAwayFromWalls(box, this.radius * 8, 8, dt);
        const { v, p } = this.bounceFromWalls(dt, box);
        this.velocity = v;
        this.position = p;
        this.acceleration = new Vector2(0, 0);
    }
    draw(renderer) {
        this.drawBody(renderer, this.position, this.velocity.angle, this.color);
    }
    setRadius(radius) {
        this.radius = radius;
    }
}
class Predator extends Boid {
    static PREY_CHASE_RATE = 15;
    constructor(position, velocity = new Vector2(1, 1), acceleration = new Vector2(0, 0)) {
        super(position, velocity, acceleration);
        this.color = Color.fromHex("#ff4455");
        this.radius = Config.boid.radius * Config.predator.radius_ratio;
    }
    steerTowardPrey(prey, rate, dt) {
        let nearest = null;
        let bestDist = Infinity;
        for (const other of prey) {
            if (other === this)
                continue;
            const d = this.position.distanceTo(other.position);
            if (d < bestDist) {
                bestDist = d;
                nearest = other;
            }
        }
        if (!nearest)
            return;
        const dir = nearest.position.subtract(this.position).normalized();
        if (this.velocity.length < 1e-6) {
            this.velocity = dir.scale(200);
            return;
        }
        const t = 1 - Math.exp(-rate * dt);
        let delta = dir.angle - this.velocity.angle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.velocity = this.velocity.rotate(delta * t);
    }
    update(dt, box, _mouse, prey) {
        this.velocity = this.velocity.add(this.acceleration.scale(dt));
        this.steerTowardPrey(prey, Predator.PREY_CHASE_RATE, dt);
        this.steerAwayFromWalls(box, 200, 8, dt);
        const { v, p } = this.bounceFromWalls(dt, box);
        this.velocity = v;
        this.position = p;
        this.acceleration = new Vector2(0, 0);
    }
}
const randomVelocity = (speed) => {
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(speed, 0).rotate(angle);
};
const randomPosition = () => new Vector2(renderer.width * Math.random(), renderer.height * Math.random());
const boids = [];
const createBoid = () => {
    const speed = renderer.width * (0.15 + Math.random() * 0.2);
    return new Boid(randomPosition(), randomVelocity(speed));
};
for (let i = 0; i < Config.boid.quantity; i++) {
    boids.push(createBoid());
}
const predator = new Predator(randomPosition(), randomVelocity(renderer.width * 0.2).scale(0.95));
const boidQuantityInput = document.querySelector("#boid-quantity");
const boidQuantityValue = document.querySelector("#boid-quantity-value");
const predatorSizeInput = document.querySelector("#predator-size");
const predatorSizeValue = document.querySelector("#predator-size-value");
const separationInput = document.querySelector("#separation-weight");
const separationValue = document.querySelector("#separation-weight-value");
const alignmentInput = document.querySelector("#alignment-weight");
const alignmentValue = document.querySelector("#alignment-weight-value");
const cohesionInput = document.querySelector("#cohesion-weight");
const cohesionValue = document.querySelector("#cohesion-weight-value");
const followWhiteButton = document.querySelector("#color-white");
const followGreenButton = document.querySelector("#color-green");
const followBlueButton = document.querySelector("#color-blue");
const syncBoidQuantity = () => {
    const target = Math.max(Number.parseInt(boidQuantityInput.value, 10), 0);
    Config.boid.quantity = target;
    while (boids.length < target) {
        boids.push(createBoid());
    }
    while (boids.length > target) {
        boids.pop();
    }
    boidQuantityValue.value = String(target);
};
const syncPredatorSize = () => {
    const ratio = Number.parseFloat(predatorSizeInput.value);
    Config.predator.radius_ratio = ratio;
    predator.setRadius(Config.boid.radius * ratio);
    predatorSizeValue.value = String(ratio);
};
const syncWeights = () => {
    Config.boid.weights.separation = Number.parseInt(separationInput.value, 10);
    Config.boid.weights.alignment = Number.parseInt(alignmentInput.value, 10);
    Config.boid.weights.cohesion = Number.parseInt(cohesionInput.value, 10);
    separationValue.value = separationInput.value;
    alignmentValue.value = alignmentInput.value;
    cohesionValue.value = cohesionInput.value;
};
const followWhite = () => {
    Config.boid.color_to_follow = -1;
};
const followGreen = () => {
    Config.boid.color_to_follow = 0;
};
const followBlue = () => {
    Config.boid.color_to_follow = 1;
};
const getColorBasedOnCode = (code) => {
    if (code === 0) {
        return Color.fromHex("#64FF64");
    }
    if (code === 1) {
        return Color.fromHex("#6464FF");
    }
    return Color.fromHex("#FFFFFF");
};
boidQuantityInput.addEventListener("input", syncBoidQuantity);
predatorSizeInput.addEventListener("input", syncPredatorSize);
separationInput.addEventListener("input", syncWeights);
alignmentInput.addEventListener("input", syncWeights);
cohesionInput.addEventListener("input", syncWeights);
followBlueButton.addEventListener("click", followBlue);
followWhiteButton.addEventListener("click", followWhite);
followGreenButton.addEventListener("click", followGreen);
syncBoidQuantity();
syncPredatorSize();
syncWeights();
let last = performance.now();
function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    const mousePosition = input.getMousePosition();
    last = now;
    renderer.fillRect(renderer.boundingRect, Color.fromHex("#242b32").withAlpha(0.35));
    renderer.fillRect(Rect.fromCenter(mousePosition, new Vector2(Config.boid.mouse_action_radius * 0.2, Config.boid.mouse_action_radius * 0.2)), getColorBasedOnCode(Config.boid.color_to_follow));
    for (const boid of boids) {
        boid.update(dt, renderer.boundingRect, mousePosition, boids, predator);
    }
    predator.update(dt, renderer.boundingRect, mousePosition, boids);
    for (const boid of boids)
        boid.draw(renderer);
    predator.draw(renderer);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
