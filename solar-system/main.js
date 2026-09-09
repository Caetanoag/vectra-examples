import { CanvasRenderer, Circle, Color, InputManager, Vector2, } from "../lib/index.js";
const G = 0.5;
const TRAIL_LENGTH = 900;
const SUBSTEPS = 4;
class CelestialBody {
    position;
    velocity;
    acceleration;
    mass;
    radius;
    color;
    name;
    circle;
    alive = true;
    trail = [];
    constructor(position, velocity, mass, radius, color, name = "") {
        this.position = position;
        this.velocity = velocity;
        this.acceleration = new Vector2(0, 0);
        this.mass = mass;
        this.radius = radius;
        this.color = color;
        this.name = name;
        this.circle = new Circle(this.position, this.radius);
        this.trail.push(this.position.clone());
    }
    update(dt) {
        this.velocity = this.velocity.add(this.acceleration.scale(dt));
        this.position = this.position.add(this.velocity.scale(dt));
        this.circle = this.circle.withCenter(this.position);
        this.trail.push(this.position.clone());
        if (this.trail.length > TRAIL_LENGTH) {
            this.trail.shift();
        }
        this.acceleration = new Vector2(0, 0);
    }
    drawTrail(renderer) {
        for (let i = 1; i < this.trail.length; i++) {
            const t = i / this.trail.length;
            renderer.drawLine(this.trail[i - 1], this.trail[i], this.color.withAlpha(t * 0.6), 1);
        }
    }
    applyForce(force) {
        this.acceleration = this.acceleration.add(force.scale(1 / this.mass));
    }
    swallow(mass) {
        this.mass += mass;
        this.radius = this.radius * 1.3;
        this.circle = this.circle.withRadius(this.radius);
    }
    draw(renderer) {
        renderer.fillCircle(this.circle, this.color);
    }
}
const getGravitationalForce = (firstBody, secondBody) => {
    const difference = secondBody.position.subtract(firstBody.position);
    const distSq = difference.lengthSq;
    const minDistance = 10;
    const distance = Math.sqrt(Math.max(distSq, minDistance * minDistance));
    const forceMag = (G * firstBody.mass * secondBody.mass) / (distance * distance);
    return difference.normalized().scale(forceMag);
};
const resolveCollision = (firstBody, secondBody) => {
    if (!firstBody.alive || !secondBody.alive)
        return;
    if (!firstBody.circle.intersects(secondBody.circle))
        return;
    if (firstBody === sun || secondBody === sun) {
        const sunBody = firstBody === sun ? firstBody : secondBody;
        const planetBody = sunBody === firstBody ? secondBody : firstBody;
        sunBody.swallow(planetBody.mass);
        planetBody.alive = false;
        return;
    }
    const first = firstBody;
    const second = secondBody;
    const normal = first.position.subtract(second.position).normalized();
    const overlap = first.circle.radius +
        second.circle.radius -
        first.position.distanceTo(second.position);
    const totalMass = first.mass + second.mass;
    first.position = first.position.add(normal.scale(overlap * (second.mass / totalMass)));
    second.position = second.position.subtract(normal.scale(overlap * (first.mass / totalMass)));
    first.circle = first.circle.withCenter(first.position);
    second.circle = second.circle.withCenter(second.position);
    const relativeVelocity = first.velocity.subtract(second.velocity).dot(normal);
    if (relativeVelocity >= 0)
        return;
    const restitution = 1;
    const impulse = (-(1 + restitution) * relativeVelocity) /
        (1 / first.mass + 1 / second.mass);
    first.velocity = first.velocity.add(normal.scale(impulse / first.mass));
    second.velocity = second.velocity.subtract(normal.scale(impulse / second.mass));
};
const renderer = new CanvasRenderer(document.querySelector("canvas"));
renderer.setSize(window.innerWidth, window.innerHeight);
let center = new Vector2(renderer.width / 2, renderer.height / 2);
const input = new InputManager(renderer.canvas);
let pan = new Vector2(0, 0);
let zoom = 1;
const minZoom = 0.3;
const maxZoom = 3;
let lastMouse = null;
renderer.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    followTarget = null;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nextZoom = Math.min(maxZoom, Math.max(minZoom, zoom * factor));
    const mouse = input.getMousePosition();
    const world = center.add(mouse
        .subtract(center)
        .subtract(pan)
        .scale(1 / zoom));
    pan = mouse
        .subtract(center)
        .subtract(world.subtract(center).scale(nextZoom));
    zoom = nextZoom;
}, { passive: false });
const starField = Array.from({ length: 220 }, (_, i) => {
    const x = (i * 97.3) % renderer.width;
    const y = (i * 61.7) % renderer.height;
    const size = 0.5 + ((i * 13) % 10) / 10;
    return { position: new Vector2(x, y), size };
});
const sun = new CelestialBody(center, new Vector2(0, 0), 10000, 50, Color.fromRgb(255, 215, 0), "Sol");
const planets = [
    {
        name: "Azul",
        radius: 150,
        angle: 0,
        speed: 1.8,
        mass: 10,
        size: 20,
        color: Color.fromRgb(0, 0, 255),
    },
    {
        name: "Vermelho",
        radius: 250,
        angle: Math.PI,
        speed: 1.4,
        mass: 15,
        size: 30,
        color: Color.fromRgb(255, 0, 0),
    },
    {
        name: "Verde",
        radius: 350,
        angle: Math.PI / 2,
        speed: 1.35,
        mass: 8,
        size: 15,
        color: Color.fromRgb(0, 255, 0),
    },
    {
        name: "Laranja",
        radius: 500,
        angle: 0.6,
        mass: 12,
        size: 16,
        color: Color.fromRgb(255, 165, 0),
    },
    {
        name: "Roxo",
        radius: 650,
        angle: 2.1,
        mass: 9,
        size: 13,
        color: Color.fromRgb(160, 32, 240),
    },
    {
        name: "Ciano",
        radius: 800,
        angle: 3.7,
        mass: 15,
        size: 18,
        color: Color.fromRgb(0, 255, 255),
    },
    {
        name: "Rosa",
        radius: 950,
        angle: 5.0,
        mass: 8,
        size: 12,
        color: Color.fromRgb(255, 20, 147),
    },
    {
        name: "Amarelo",
        radius: 1100,
        angle: 1.2,
        mass: 11,
        size: 15,
        color: Color.fromRgb(255, 255, 0),
    },
    {
        name: "Magenta",
        radius: 1250,
        angle: 4.4,
        mass: 7,
        size: 10,
        color: Color.fromRgb(255, 105, 180),
    },
    {
        name: "Vermelho-escuro",
        radius: 1400,
        angle: 2.8,
        mass: 13,
        size: 17,
        color: Color.fromRgb(255, 69, 0),
    },
].map(({ name, radius, angle, speed, mass, size, color }) => {
    const orbitalSpeed = speed ?? Math.sqrt((G * sun.mass) / radius);
    return new CelestialBody(center.add(Vector2.fromPolar(angle, radius)), Vector2.fromAngle(angle + Math.PI / 2).scale(orbitalSpeed), mass, size, color, name);
});
let bodies = [sun, ...planets];
let dt = 1;
let followTarget = null;
const menu = document.querySelector("#planetMenu");
const speedControl = document.createElement("label");
speedControl.className = "speed";
speedControl.textContent = "Velocidade: ";
const speedSelect = document.createElement("select");
["1", "2", "5", "10", "20", "100"].forEach((factor) => {
    const option = document.createElement("option");
    option.value = factor;
    option.textContent = `${factor}x`;
    speedSelect.appendChild(option);
});
speedSelect.addEventListener("change", () => {
    dt = Number(speedSelect.value);
});
speedControl.appendChild(speedSelect);
menu.appendChild(speedControl);
const menuEntries = bodies.map((body) => {
    const label = document.createElement("div");
    label.className = "entry";
    label.addEventListener("click", () => {
        followTarget = body;
    });
    menu.appendChild(label);
    return { body, label };
});
const loop = () => {
    const mouse = input.getMousePosition();
    if (input.isMouseDown(0)) {
        followTarget = null;
        if (lastMouse) {
            pan = pan.add(mouse.subtract(lastMouse).scale(1 / zoom));
        }
        lastMouse = mouse;
    }
    else {
        lastMouse = null;
    }
    const panSpeed = 8 / zoom;
    let panX = 0;
    let panY = 0;
    if (input.isKeyDown("ArrowLeft") || input.isKeyDown("a"))
        panX += panSpeed;
    if (input.isKeyDown("ArrowRight") || input.isKeyDown("d"))
        panX -= panSpeed;
    if (input.isKeyDown("ArrowUp") || input.isKeyDown("w"))
        panY += panSpeed;
    if (input.isKeyDown("ArrowDown") || input.isKeyDown("s"))
        panY -= panSpeed;
    if (panX !== 0 || panY !== 0) {
        followTarget = null;
        pan = pan.translate(panX, panY);
    }
    input.update();
    if (followTarget) {
        pan = center.subtract(followTarget.position).scale(zoom);
    }
    menuEntries.forEach(({ body, label }) => {
        const offset = body.position.subtract(sun.position);
        label.textContent = `${body.name}: ${offset.length.toFixed(0)}px (dx ${offset.x.toFixed(0)}, dy ${offset.y.toFixed(0)})`;
    });
    const stepDt = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const firstBody = bodies[i];
                const secondBody = bodies[j];
                const forceOnFirst = getGravitationalForce(firstBody, secondBody);
                const forceOnSecond = forceOnFirst.scale(-1);
                firstBody.applyForce(forceOnFirst);
                secondBody.applyForce(forceOnSecond);
            }
        }
        bodies.forEach((body) => {
            body.update(stepDt);
        });
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                resolveCollision(bodies[i], bodies[j]);
            }
        }
        bodies = bodies.filter((body) => body.alive);
        if (followTarget && !followTarget.alive)
            followTarget = null;
        for (let k = menuEntries.length - 1; k >= 0; k--) {
            const entry = menuEntries[k];
            if (!entry.body.alive) {
                entry.label.remove();
                menuEntries.splice(k, 1);
            }
        }
    }
    renderer.clear();
    starField.forEach((s) => {
        renderer.fillCircle(s.position, s.size, Color.fromRgb(255, 255, 255, 60 + ((s.size * 10) % 100)));
    });
    renderer.save();
    renderer.translate(center.x + pan.x, center.y + pan.y);
    renderer.scale(zoom, zoom);
    renderer.translate(-center.x, -center.y);
    const glow = Color.fromRgb(255, 200, 50);
    [80, 120, 170].forEach((radius) => {
        renderer.strokeCircle(sun.position, radius, glow.withAlpha(0.15), 2);
    });
    bodies.forEach((body) => {
        body.drawTrail(renderer);
        body.draw(renderer);
    });
    renderer.restore();
    requestAnimationFrame(loop);
};
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    center = new Vector2(renderer.width / 2, renderer.height / 2);
});
requestAnimationFrame(loop);
