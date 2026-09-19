import {
	CanvasRenderer,
	Circle,
	Color,
	InputManager,
	Rect,
	Vector2,
} from "../lib/index.js";

/** Height of the shared header (--vt-header-h token from index.html) so the canvas fits below it. */
const HEADER_HEIGHT =
	parseInt(getComputedStyle(document.documentElement).getPropertyValue("--vt-header-h")) || 0;

const randomInteger = (min: number, max: number): number => {
	return Math.trunc(Math.random() * (max - min) + min);
};

const randomColor = (colors: Array<Color>) => {
	const index = randomInteger(0, colors.length);
	return colors[index];
};

const MIN_RADIUS = 10;
const MAX_RADIUS = 15;
const BG_COLOR = new Color(11 / 255, 15 / 255, 20 / 255);
let GRAVITY = 2;
let elasticity = 0.92;
let particleIdCounter = 0;

class SpatialHash {
	private cellSize: number;
	private grid: Map<string, Particle[]> = new Map();

	constructor(cellSize: number) {
		this.cellSize = cellSize;
	}

	public clear(): void {
		this.grid.clear();
	}

	public insert(particle: Particle): void {
		const cx = Math.floor(particle.position.x / this.cellSize);
		const cy = Math.floor(particle.position.y / this.cellSize);
		const key = `${cx},${cy}`;
		let cell = this.grid.get(key);
		if (!cell) {
			cell = [];
			this.grid.set(key, cell);
		}
		cell.push(particle);
	}

	public getNearby(particle: Particle): Particle[] {
		const nearby: Particle[] = [];
		const cx = Math.floor(particle.position.x / this.cellSize);
		const cy = Math.floor(particle.position.y / this.cellSize);

		for (let x = -1; x <= 1; x++) {
			for (let y = -1; y <= 1; y++) {
				const key = `${cx + x},${cy + y}`;
				const cell = this.grid.get(key);
				if (cell) {
					for (let i = 0; i < cell.length; i++) {
						nearby.push(cell[i] as Particle);
					}
				}
			}
		}
		return nearby;
	}
}

class Particle {
	public id: number;
	public position: Vector2;
	public velocity: Vector2;
	public acceleration: Vector2;
	private color: Color;
	private circle: Circle;
	public mass: number;
	private e: number = elasticity;

	constructor(position: Vector2, velocity: Vector2, color: Color) {
		this.id = particleIdCounter++;
		this.position = position;
		this.velocity = velocity;
		this.acceleration = new Vector2(0, GRAVITY);
		this.color = color;
		const radius = randomInteger(MIN_RADIUS, MAX_RADIUS);
		this.circle = new Circle(this.position, radius);
		this.mass = 0.5 * radius * radius;
	}

	public collideWithBorder(boundingBox: Rect): void {
		const myBox: Rect = this.circle.boundingBox;
		const radius = this.circle.radius;

		if (myBox.left < boundingBox.left) {
			this.velocity = new Vector2(
				Math.abs(this.velocity.x) * this.e,
				this.velocity.y,
			);
			this.position = new Vector2(boundingBox.left + radius, this.position.y);
		} else if (myBox.right > boundingBox.right) {
			this.velocity = new Vector2(
				-Math.abs(this.velocity.x) * this.e,
				this.velocity.y,
			);
			this.position = new Vector2(boundingBox.right - radius, this.position.y);
		}

		if (myBox.top < boundingBox.top) {
			this.velocity = new Vector2(
				this.velocity.x,
				Math.abs(this.velocity.y) * this.e,
			);
			this.position = new Vector2(this.position.x, boundingBox.top + radius);
		} else if (myBox.bottom > boundingBox.bottom) {
			let vy = -Math.abs(this.velocity.y) * this.e;

			if (Math.abs(this.velocity.y) <= 1.5) {
				vy = 0;
			}

			const vx = this.velocity.x * 0.9;

			this.velocity = new Vector2(vx, vy);
			this.position = new Vector2(this.position.x, boundingBox.bottom - radius);
		}
		this.circle = new Circle(this.position, radius);
	}

	public collideWithParticle(other: Particle): void {
		const delta = this.position.subtract(other.position);
		const distance = Math.hypot(delta.x, delta.y);
		const minDistance = this.circle.radius + other.circle.radius;

		if (distance >= minDistance || distance === 0) return;

		const normal = delta.scale(1 / distance);
		const overlap = minDistance - distance;

		const totalMass = this.mass + other.mass;
		this.position = this.position.add(
			normal.scale(overlap * (other.mass / totalMass)),
		);
		other.position = other.position.subtract(
			normal.scale(overlap * (this.mass / totalMass)),
		);

		this.circle = new Circle(this.position, this.circle.radius);
		other.circle = new Circle(other.position, other.circle.radius);

		const relativeVelocity = this.velocity.subtract(other.velocity);
		const velAlongNormal =
			relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;

		if (velAlongNormal > 0) return;

		let restitution = Math.min(this.e, other.e);

		if (Math.abs(velAlongNormal) < 2.0) {
			restitution = 0;
			this.velocity = this.velocity.scale(0.98);
			other.velocity = other.velocity.scale(0.98);
		}

		const invMass1 = 1 / this.mass;
		const invMass2 = 1 / other.mass;

		const impulseMagnitude =
			(-(1 + restitution) * velAlongNormal) / (invMass1 + invMass2);
		const impulse = normal.scale(impulseMagnitude);

		this.velocity = this.velocity.add(impulse.scale(invMass1));
		other.velocity = other.velocity.subtract(impulse.scale(invMass2));
	}

	public setElasticity(value: number): void {
		this.e = value;
	}

	public setGravity(value: number): void {
		this.acceleration = new Vector2(0, value);
	}

	public setColor(value: Color): void {
		this.color = value;
	}

	public draw(renderer: CanvasRenderer): void {
		renderer.fillCircle(this.circle, this.color);
	}

	public update(dt: number) {
		this.velocity = this.velocity.add(this.acceleration.scale(dt));
		this.position = this.position.add(this.velocity.scale(dt));
		this.circle = new Circle(this.position, this.circle.radius);
	}
}

const canvas = document.querySelector("#bouncing-canvas");
const renderer = new CanvasRenderer(canvas as HTMLCanvasElement);
const input = new InputManager(canvas as HTMLElement);
renderer.setSize(window.innerWidth * 0.9, (window.innerHeight - HEADER_HEIGHT) * 0.75);

window.addEventListener("resize", () => {
	renderer.setSize(window.innerWidth * 0.9, (window.innerHeight - HEADER_HEIGHT) * 0.75);
});

const boundingBox = new Rect(0, 0, renderer.width, renderer.height);
const particles: Particle[] = [];
const colors: Color[] = [
	Color.white(),
	Color.fromRgb(255, 215, 0),
	Color.fromRgb(0, 255, 255),
	Color.fromRgb(255, 45, 120),
];

const spatialHash = new SpatialHash(MAX_RADIUS * 2);

const PARTICLE_COUNT = 3;
const createRandomParticle = (): Particle =>
	new Particle(
		new Vector2(
			renderer.width / 2 + randomInteger(-150, 150),
			renderer.height / 2 + randomInteger(-150, 150),
		),
		new Vector2(randomInteger(-5, 5), randomInteger(-5, 5)),
		randomColor(colors) as Color,
	);

for (let i = 0; i < PARTICLE_COUNT; i++) {
	particles.push(createRandomParticle());
}

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

const elasticityInput = document.querySelector(
	"#elasticity",
) as HTMLInputElement;
const gravityInput = document.querySelector("#gravity") as HTMLInputElement;
const elasticityValue = document.querySelector(
	"#elasticity-value",
) as HTMLOutputElement;
const gravityValue = document.querySelector(
	"#gravity-value",
) as HTMLOutputElement;
const applyConstantsButton = document.querySelector(
	"#apply-constants",
) as HTMLButtonElement;
const clearParticlesButton = document.querySelector(
	"#clear-particles",
) as HTMLButtonElement;
const addParticleButton = document.querySelector(
	"#add-particle",
) as HTMLButtonElement;
const colorButtons =
	document.querySelectorAll<HTMLButtonElement>(".color-button");

const trailsToggle = document.querySelector(
	"#trails-toggle",
) as HTMLInputElement;
const trailsLength = document.querySelector(
	"#trails-length",
) as HTMLInputElement;
const trailsLengthValue = document.querySelector(
	"#trails-length-value",
) as HTMLOutputElement;
const trailsLengthRow = document.querySelector(
	"#trails-length-row",
) as HTMLElement;

let trailsEnabled = false;
let trailAlpha = 0.025;

const updateTrailAlpha = (): void => {
	const length = Math.max(Number.parseInt(trailsLength.value, 10), 1);
	trailAlpha = 0.1 / length;
	trailsLengthValue.value = String(length);
};

updateTrailAlpha();

trailsToggle.addEventListener("change", () => {
	trailsEnabled = trailsToggle.checked;
	trailsLengthRow.hidden = !trailsEnabled;
});

trailsLength.addEventListener("input", updateTrailAlpha);

elasticityInput.addEventListener("input", () => {
	elasticityValue.value = elasticityInput.value;
});

gravityInput.addEventListener("input", () => {
	gravityValue.value = gravityInput.value;
});

applyConstantsButton.addEventListener("click", () => {
	const eRaw = Number.parseFloat(elasticityInput.value);
	const gRaw = Number.parseFloat(gravityInput.value);
	const e = Number.isNaN(eRaw) ? elasticity : clamp(eRaw, 0, 1);
	const g = Number.isNaN(gRaw) ? GRAVITY : clamp(gRaw, 0.2, 3);

	elasticity = e;
	GRAVITY = g;

	particles.forEach((p: Particle) => {
		p.setElasticity(e);
		p.setGravity(g);
	});

	elasticityInput.value = String(e);
	elasticityValue.value = String(e);
	gravityInput.value = String(g);
	gravityValue.value = String(g);
});

clearParticlesButton.addEventListener("click", () => {
	particles.length = 0;
	renderer.clear();
});

addParticleButton.addEventListener("click", () => {
	particles.push(createRandomParticle());
});

colorButtons.forEach((button, index) => {
	button.addEventListener("click", () => {
		const color = colors[index] as Color;
		particles.forEach((p: Particle) => {
			p.setColor(color);
		});
	});
});

const dt = 1;
let clear = true;
const loop = (): void => {
	if (input.isMouseDown()) {
		const pos = input.getMousePosition();
		particles.push(
			new Particle(
				pos,
				new Vector2(randomInteger(-5, 5), randomInteger(-5, 5)),
				randomColor(colors) as Color,
			),
		);
	}

	if (input.isKeyPressed(" ")) {
		particles.forEach((p: Particle) => {
			p.velocity.y -= 5000 / p.mass;
		});
	}

	if (input.isKeyPressed("T")) {
		trailsEnabled = !trailsEnabled;
		trailsToggle.checked = trailsEnabled;
		trailsLengthRow.hidden = !trailsEnabled;
	}

	particles.forEach((p: Particle) => {
		p.update(dt);
	});

	const iterations = 10;
	for (let k = 0; k < iterations; k++) {
		spatialHash.clear();
		for (let i = 0; i < particles.length; i++) {
			spatialHash.insert(particles[i] as Particle);
		}

		for (let i = 0; i < particles.length; i++) {
			const p1 = particles[i] as Particle;
			const neighbors = spatialHash.getNearby(p1);

			for (let j = 0; j < neighbors.length; j++) {
				const p2 = neighbors[j] as Particle;
				if (p2.id > p1.id) {
					p1.collideWithParticle(p2);
				}
			}
		}

		for (let i = 0; i < particles.length; i++) {
			particles[i]?.collideWithBorder(boundingBox);
		}
	}
	if (trailsEnabled && !clear) {
		renderer.fillRect(boundingBox, BG_COLOR.withAlpha(trailAlpha));
		clear = true;
	} else {
		renderer.clear();
		clear = false;
	}
	renderer.strokeRect(boundingBox, Color.blue());
	particles.forEach((p: Particle) => {
		p.draw(renderer);
	});

	input.update();
	requestAnimationFrame(loop);
};

requestAnimationFrame(loop);
