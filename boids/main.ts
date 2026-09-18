import {
	CanvasRenderer,
	Color,
	InputManager,
	Rect,
	Vector2,
} from "../lib/index.js";

class Boid {
	public position: Vector2;
	public velocity: Vector2;
	public acceleration: Vector2;
	private readonly COLOR: Color;
	public static readonly RADIUS: number = 10;
	public static readonly MOUSE_FEAR_RADIUS: number = Boid.RADIUS * 10;

	constructor(
		position: Vector2,
		velocity: Vector2 = new Vector2(1, 1),
		acceleration: Vector2 = new Vector2(0, 0),
	) {
		this.position = position;
		this.velocity = velocity;
		this.acceleration = acceleration;
		this.COLOR = new Color(Math.random(), Math.random(), Math.random());
	}
	private separation(others: Boid[], radius: number): Vector2 {
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
	private alignment(others: Boid[], radius: number): Vector2 {
		let avg = new Vector2(0, 0);
		let count = 0;
		for (const other of others) {
			if (other === this) continue;
			if (this.position.distanceTo(other.position) < radius) {
				avg = avg.add(other.velocity.normalized());
				count++;
			}
		}
		return count > 0 ? avg.normalized() : new Vector2(0, 0);
	}
	private cohesion(others: Boid[], radius: number): Vector2 {
		let center = new Vector2(0, 0);
		let count = 0;
		for (const other of others) {
			if (other === this) continue;
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
	private steerFromFlock(others: Boid[], dt: number): void {
		const sep = this.separation(others, 90).scale(3);
		const ali = this.alignment(others, 100).scale(1.0);
		const coh = this.cohesion(others, 100).scale(0.8);
		const wander = (Math.random() - 0.5) * 0.15;
		const dir = sep.add(ali).add(coh).rotate(wander);
		if (dir.length < 1e-6) return;
		if (this.velocity.length < 1e-6) {
			this.velocity = dir.normalized().scale(200);
			return;
		}

		const t = 1 - Math.exp(-4 * dt);
		let delta = dir.angle - this.velocity.angle;
		delta = Math.atan2(Math.sin(delta), Math.cos(delta));
		this.velocity = this.velocity.rotate(delta * t);
	}
	private steerAwayFromWalls(
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
	private bounceFromWalls(dt: number, box: Rect): { v: Vector2; p: Vector2 } {
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
	private steerAwayFromMouse(mouse: Vector2, rate: number, dt: number): void {
		const away = this.position.subtract(mouse);
		const distance = away.length;

		if (distance >= Boid.MOUSE_FEAR_RADIUS || distance < 1e-6) return;
		if (this.velocity.length < 1e-6) {
			this.velocity = away.normalized().scale(200);
			return;
		}

		const t = 1 - Math.exp(-rate * dt);
		let delta = away.angle - this.velocity.angle;
		delta = Math.atan2(Math.sin(delta), Math.cos(delta));
		this.velocity = this.velocity.rotate(delta * t);
	}
	public update(dt: number, box: Rect, mouse: Vector2, boids: Boid[]) {
		this.velocity = this.velocity.add(this.acceleration.scale(dt));
		this.steerFromFlock(boids, dt);
		this.steerAwayFromMouse(mouse, 8, dt);
		this.steerAwayFromWalls(box, 200, 8, dt);
		const { v, p } = this.bounceFromWalls(dt, box);
		this.velocity = v;
		this.position = p;
		this.acceleration = new Vector2(0, 0);
	}
	public draw(renderer: CanvasRenderer): void {
		const r = Boid.RADIUS;

		const angle = this.velocity.normalized().angle;

		const tip = this.position.add(new Vector2(r, 0).rotate(angle));
		const bottomLeft = this.position.add(new Vector2(-r, -r).rotate(angle));
		const bottomRight = this.position.add(new Vector2(-r, r).rotate(angle));

		renderer.fillPolygon([tip, bottomLeft, bottomRight], this.COLOR);
	}
}
const canvas = document.querySelector("canvas");
const renderer = new CanvasRenderer(canvas as HTMLCanvasElement);
const input = new InputManager(canvas as HTMLElement);
renderer.setSize(window.innerWidth, window.innerHeight);
const randomVelocity = (): Vector2 => {
	const minSpeed = renderer.width * 0.15;
	const maxSpeed = renderer.width * 0.35;
	const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
	const angle = Math.random() * Math.PI * 2;
	return new Vector2(speed, 0).rotate(angle);
};
const randomPosition = (): Vector2 => {
	return new Vector2(
		renderer.width * Math.random(),
		renderer.height * Math.random(),
	);
};
const boids: Boid[] = [];
for (let i = 0; i < 100; i++) {
	boids.push(new Boid(randomPosition(), randomVelocity()));
}

let last = performance.now();

function loop() {
	const now = performance.now();
	const dt = Math.min((now - last) / 1000, 0.05);
	const mousePosition = input.getMousePosition();
	last = now;

	renderer.fillRect(
		renderer.boundingRect,
		Color.fromHex("#242b32").withAlpha(0.3),
	);
	renderer.fillRect(
		Rect.fromCenter(
			mousePosition,
			new Vector2(Boid.MOUSE_FEAR_RADIUS * 0.2, Boid.MOUSE_FEAR_RADIUS * 0.2),
		),
		Color.green(),
	);
	boids.forEach((boid) => {
		boid.update(dt, renderer.boundingRect, mousePosition, boids);
	});
	boids.forEach((boid) => {
		boid.draw(renderer);
	});

	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
