import { CanvasRenderer, Color, type Rect, Vector2 } from "../lib/index.js";

class Boid {
	public position: Vector2;
	public velocity: Vector2;
	public acceleration: Vector2;
	private static readonly COLOR: Color = Color.black();
	private static readonly RADIUS: number = 10;

	constructor(
		position: Vector2,
		velocity: Vector2 = new Vector2(1, 1),
		acceleration: Vector2 = new Vector2(0, 0),
	) {
		this.position = position;
		this.velocity = velocity;
		this.acceleration = acceleration;
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
	public update(dt: number, box: Rect) {
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
	public draw(renderer: CanvasRenderer): void {
		const r = Boid.RADIUS;

		const angle = this.velocity.normalized().angle;

		const tip = this.position.add(new Vector2(r, 0).rotate(angle));
		const bottomLeft = this.position.add(new Vector2(-r, -r).rotate(angle));
		const bottomRight = this.position.add(new Vector2(-r, r).rotate(angle));

		renderer.fillPolygon([tip, bottomLeft, bottomRight], Boid.COLOR);
	}
}
const canvas = document.querySelector("canvas");
const renderer = new CanvasRenderer(canvas as HTMLCanvasElement);
renderer.setSize(window.innerWidth, window.innerHeight);
const boid = new Boid(
	renderer.boundingRect.center,
	new Vector2(0.5, 1.2).scale(renderer.width),
);

const dt = 1 / 60;
function loop() {
	renderer.clear();
	boid.draw(renderer);
	boid.update(dt, renderer.boundingRect);
	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
