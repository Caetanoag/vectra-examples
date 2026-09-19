import {
	CanvasRenderer,
	Color,
	InputManager,
	Rect,
	Vector2,
} from "../lib/index.js";

const canvas = document.querySelector("canvas");
const renderer = new CanvasRenderer(canvas as HTMLCanvasElement);
const input = new InputManager(canvas as HTMLElement);
renderer.setSize(window.innerWidth, window.innerHeight);

const Config = {
	boid: {
		radius: renderer.width * 0.005,
		wander: 0.005,
		get mouse_fear_radius() {
			return this.radius * 10;
		},
		get predator_fear_radius() {
			return this.radius * 10;
		},
		weights: {
			separation: 3,
			aligment: 1,
			coesion: 0.8,
		},
	},
};

class Boid {
	public position: Vector2;
	public velocity: Vector2;
	public acceleration: Vector2;

	protected color: Color;
	protected radius: number;

	protected static readonly DEFAULT_RADIUS = Config.boid.radius;
	protected static readonly WANDER_STRENGTH = Config.boid.wander;
	public static readonly MOUSE_FEAR_RADIUS = Config.boid.mouse_fear_radius;
	public static readonly PREDATOR_FEAR_RADIUS =
		Config.boid.predator_fear_radius;
	private readonly SPECIES: number;
	constructor(
		position: Vector2,
		velocity: Vector2 = new Vector2(1, 1),
		acceleration: Vector2 = new Vector2(0, 0),
	) {
		this.position = position;
		this.velocity = velocity;
		this.acceleration = acceleration;
		this.SPECIES = (Math.random() * 10) & 1;

		if (this.SPECIES === 1) {
			this.color = Color.fromRgb(100, 100, 255);
		} else {
			this.color = Color.fromRgb(100, 255, 100);
		}
		this.radius = Boid.DEFAULT_RADIUS;
	}

	protected separation(others: Boid[], radius: number): Vector2 {
		let force = new Vector2(0, 0);
		let count = 0;
		for (const other of others) {
			if (other === this) continue;
			const away = this.position.subtract(other.position);
			const dist = away.length;
			if (dist < radius && dist > 1e-6) {
				force = force.add(away.normalized().scale(1 - dist / radius));
				count++;
			}
		}
		return count > 0 ? force.scale(1 / count) : new Vector2(0, 0);
	}

	protected alignment(others: Boid[], radius: number): Vector2 {
		let avg = new Vector2(0, 0);
		let count = 0;
		for (const other of others) {
			if (other === this) continue;
			if (other.SPECIES !== this.SPECIES) continue;
			if (this.position.distanceTo(other.position) < radius) {
				avg = avg.add(other.velocity.normalized());
				count++;
			}
		}
		return count > 0 ? avg.normalized() : new Vector2(0, 0);
	}

	protected cohesion(others: Boid[], radius: number): Vector2 {
		let center = new Vector2(0, 0);
		let count = 0;
		for (const other of others) {
			if (other === this) continue;
			if (other.SPECIES !== this.SPECIES) continue;
			if (this.position.distanceTo(other.position) < radius) {
				center = center.add(other.position);
				count++;
			}
		}
		if (count === 0) return new Vector2(0, 0);
		return center
			.scale(1 / count)
			.subtract(this.position)
			.normalized();
	}

	protected steerFromFlock(others: Boid[], dt: number): void {
		const sep = this.separation(others, 40).scale(
			Config.boid.weights.separation,
		);
		const ali = this.alignment(others, 80).scale(Config.boid.weights.aligment);
		const coh = this.cohesion(others, 80).scale(Config.boid.weights.coesion);

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

	protected steerAwayFromPoint(
		point: Vector2,
		fearRadius: number,
		rate: number,
		dt: number,
	): void {
		const away = this.position.subtract(point);
		const distance = away.length;

		if (distance >= fearRadius || distance < 1e-6) return;
		if (this.velocity.length < 1e-6) {
			this.velocity = away.normalized().scale(200);
			return;
		}

		const t = 1 - Math.exp(-rate * dt);
		let delta = away.angle - this.velocity.angle;
		delta = Math.atan2(Math.sin(delta), Math.cos(delta));
		this.velocity = this.velocity.rotate(delta * t);
	}

	protected steerAwayFromWalls(
		box: Rect,
		margin: number,
		rate: number,
		dt: number,
	): void {
		let dir = new Vector2(0, 0);

		if (this.position.x < box.left + margin) dir = dir.add(new Vector2(1, 0));
		else if (this.position.x > box.right - margin)
			dir = dir.add(new Vector2(-1, 0));

		if (this.position.y < box.top + margin) dir = dir.add(new Vector2(0, 1));
		else if (this.position.y > box.bottom - margin)
			dir = dir.add(new Vector2(0, -1));

		if (dir.length < 1e-6) return;
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

	protected bounceFromWalls(dt: number, box: Rect): { v: Vector2; p: Vector2 } {
		const r = this.radius;
		let p = this.position.add(this.velocity.scale(dt));
		let v = this.velocity;

		if (p.x < box.left + r || p.x > box.right - r) {
			v = new Vector2(-v.x, v.y);
			p = new Vector2(
				Math.max(box.left + r, Math.min(box.right - r, p.x)),
				p.y,
			);
		}
		if (p.y < box.top + r || p.y > box.bottom - r) {
			v = new Vector2(v.x, -v.y);
			p = new Vector2(
				p.x,
				Math.max(box.top + r, Math.min(box.bottom - r, p.y)),
			);
		}
		return { v, p };
	}
	protected drawBody(
		renderer: CanvasRenderer,
		position: Vector2,
		angle: number,
		color: Color,
	): void {
		const r = this.radius;
		const tip = position.add(new Vector2(r, 0).rotate(angle));
		const bottomLeft = position.add(new Vector2(-r, -r).rotate(angle));
		const bottomRight = position.add(new Vector2(-r, r).rotate(angle));
		renderer.fillPolygon([tip, bottomLeft, bottomRight], color);
	}

	public update(
		dt: number,
		box: Rect,
		mouse: Vector2,
		boids: Boid[],
		predator?: Boid,
	): void {
		this.velocity = this.velocity.add(this.acceleration.scale(dt));

		this.steerFromFlock(boids, dt);
		if (predator)
			this.steerAwayFromPoint(
				predator.position,
				Boid.PREDATOR_FEAR_RADIUS,
				6,
				dt,
			);
		this.steerAwayFromPoint(mouse, Boid.MOUSE_FEAR_RADIUS, 8, dt);
		this.steerAwayFromWalls(box, this.radius * 8, 8, dt);

		const { v, p } = this.bounceFromWalls(dt, box);
		this.velocity = v;
		this.position = p;
		this.acceleration = new Vector2(0, 0);
	}

	public draw(renderer: CanvasRenderer): void {
		this.drawBody(renderer, this.position, this.velocity.angle, this.color);
	}
}

class Predator extends Boid {
	private static readonly PREY_CHASE_RATE = 15;

	constructor(
		position: Vector2,
		velocity: Vector2 = new Vector2(1, 1),
		acceleration: Vector2 = new Vector2(0, 0),
	) {
		super(position, velocity, acceleration);
		this.color = Color.fromHex("#ff4455");
		this.radius = Boid.DEFAULT_RADIUS * 1.8;
	}

	private steerTowardPrey(prey: Boid[], rate: number, dt: number): void {
		let nearest: Boid | null = null;
		let bestDist = Infinity;

		for (const other of prey) {
			if (other === this) continue;
			const d = this.position.distanceTo(other.position);
			if (d < bestDist) {
				bestDist = d;
				nearest = other;
			}
		}

		if (!nearest) return;

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

	public override update(
		dt: number,
		box: Rect,
		_mouse: Vector2,
		prey: Boid[],
	): void {
		this.velocity = this.velocity.add(this.acceleration.scale(dt));

		this.steerTowardPrey(prey, Predator.PREY_CHASE_RATE, dt);
		this.steerAwayFromWalls(box, 200, 8, dt);

		const { v, p } = this.bounceFromWalls(dt, box);
		this.velocity = v;
		this.position = p;
		this.acceleration = new Vector2(0, 0);
	}
}

const randomVelocity = (speed: number): Vector2 => {
	const angle = Math.random() * Math.PI * 2;
	return new Vector2(speed, 0).rotate(angle);
};
const randomPosition = (): Vector2 =>
	new Vector2(renderer.width * Math.random(), renderer.height * Math.random());

const boids: Boid[] = [];
for (let i = 0; i < 100; i++) {
	const speed = renderer.width * (0.15 + Math.random() * 0.2);
	boids.push(new Boid(randomPosition(), randomVelocity(speed)));
}

const predator = new Predator(
	randomPosition(),
	randomVelocity(renderer.width * 0.2).scale(0.95),
);

let last = performance.now();

function loop(now: number) {
	const dt = Math.min((now - last) / 1000, 0.05);
	const mousePosition = input.getMousePosition();
	last = now;

	renderer.fillRect(
		renderer.boundingRect,
		Color.fromHex("#242b32").withAlpha(0.35),
	);
	renderer.fillRect(
		Rect.fromCenter(
			mousePosition,
			new Vector2(
				Config.boid.mouse_fear_radius * 0.2,
				Config.boid.mouse_fear_radius * 0.2,
			),
		),
		Color.green(),
	);

	for (const boid of boids) {
		boid.update(dt, renderer.boundingRect, mousePosition, boids, predator);
	}
	predator.update(dt, renderer.boundingRect, mousePosition, boids);

	for (const boid of boids) boid.draw(renderer);
	predator.draw(renderer);

	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
