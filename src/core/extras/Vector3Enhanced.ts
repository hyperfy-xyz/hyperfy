import { Quaternion, MathUtils } from 'three'

/**
 * This is an enhanced version of THREE.Vector3 to add the _onChange function
 * to match THREE.Quaternion
 * 
 * Current version is from THREE v167
 * 
 * The initial unmodified version was committed so you can diff what changed.
 */

// Global PHYSX declaration
declare const PHYSX: any;

interface Euler {
	_x: number;
	_y: number;
	_z: number;
	_order?: string;
}

interface Camera {
	matrixWorldInverse: { elements: number[] };
	projectionMatrix: { elements: number[] };
	projectionMatrixInverse: { elements: number[] };
	matrixWorld: { elements: number[] };
}

interface BufferAttribute {
	getX(index: number): number;
	getY(index: number): number;
	getZ(index: number): number;
}

let _vector: Vector3Enhanced | null = null;

export class Vector3Enhanced {
	_x: number;
	_y: number;
	_z: number;
	readonly isVector3 = true as const;
	readonly isVector3Enhanced = true as const;

	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this._x = x;
		this._y = y;
		this._z = z;
	}

	get x() {
		return this._x;
	}

	set x(value: number) {
		this._x = value;
		this._onChangeCallback();
	}

	get y() {
		return this._y;
	}

	set y(value: number) {
		this._y = value;
		this._onChangeCallback();
	}

	get z() {
		return this._z;
	}

	set z(value: number) {
		this._z = value;
		this._onChangeCallback();
	}

	set(x: number, y: number, z?: number): this {
		if (z === undefined) z = this._z;

		this._x = x;
		this._y = y;
		this._z = z;

		this._onChangeCallback();

		return this;
	}

	setScalar(scalar: number): this {
		this._x = scalar;
		this._y = scalar;
		this._z = scalar;
		this._onChangeCallback();
		return this;
	}

	setX(x: number): this {
		this._x = x;
		this._onChangeCallback();
		return this;
	}

	setY(y: number): this {
		this._y = y;
		this._onChangeCallback();
		return this;
	}

	setZ(z: number): this {
		this._z = z;
		this._onChangeCallback();
		return this;
	}

	setComponent(index: number, value: number): this {
		switch (index) {
			case 0:
				this.x = value;
				break;
			case 1:
				this.y = value;
				break;
			case 2:
				this.z = value;
				break;
			default:
				throw new Error('index is out of range: ' + index);
		}
		return this;
	}

	getComponent(index: number): number {
		switch (index) {
			case 0:
				return this.x;
			case 1:
				return this.y;
			case 2:
				return this.z;
			default:
				throw new Error('index is out of range: ' + index);
		}
	}

	clone(): Vector3Enhanced {
		return new Vector3Enhanced(this._x, this._y, this._z);
	}

	copy(v: { x: number; y: number; z: number }): this {
		this._x = v.x;
		this._y = v.y;
		this._z = v.z;
		this._onChangeCallback();
		return this;
	}

	add(v: { x: number; y: number; z: number }): this {
		this._x += v.x;
		this._y += v.y;
		this._z += v.z;
		this._onChangeCallback();
		return this;
	}

	addScalar(s: number): this {
		this._x += s;
		this._y += s;
		this._z += s;
		this._onChangeCallback();
		return this;
	}

	addVectors(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): this {
		this._x = a.x + b.x;
		this._y = a.y + b.y;
		this._z = a.z + b.z;
		this._onChangeCallback();
		return this;
	}

	addScaledVector(v: { x: number; y: number; z: number }, s: number): this {
		this._x += v.x * s;
		this._y += v.y * s;
		this._z += v.z * s;
		this._onChangeCallback();
		return this;
	}

	sub(v: { x: number; y: number; z: number }): this {
		this._x -= v.x;
		this._y -= v.y;
		this._z -= v.z;
		this._onChangeCallback();
		return this;
	}

	subScalar(s: number): this {
		this._x -= s;
		this._y -= s;
		this._z -= s;
		this._onChangeCallback();
		return this;
	}

	subVectors(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): this {
		this._x = a.x - b.x;
		this._y = a.y - b.y;
		this._z = a.z - b.z;
		this._onChangeCallback();
		return this;
	}

	multiply(v: { x: number; y: number; z: number }): this {
		this._x *= v.x;
		this._y *= v.y;
		this._z *= v.z;
		this._onChangeCallback();
		return this;
	}

	multiplyScalar(scalar: number): this {
		this._x *= scalar;
		this._y *= scalar;
		this._z *= scalar;
		this._onChangeCallback();
		return this;
	}

	multiplyVectors(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): this {
		this._x = a.x * b.x;
		this._y = a.y * b.y;
		this._z = a.z * b.z;
		this._onChangeCallback();
		return this;
	}

	applyEuler(euler: Euler): this {
		return this.applyQuaternion(new Quaternion().setFromEuler(euler as any));
	}

	applyAxisAngle(axis: { x: number; y: number; z: number }, angle: number): this {
		return this.applyQuaternion(new Quaternion().setFromAxisAngle(axis, angle));
	}

	applyMatrix3(m: { elements: number[] }): this {
		const x = this._x, y = this._y, z = this._z;
		const e = m.elements;

		this._x = e[0]! * x + e[3]! * y + e[6]! * z;
		this._y = e[1]! * x + e[4]! * y + e[7]! * z;
		this._z = e[2]! * x + e[5]! * y + e[8]! * z;

		this._onChangeCallback();

		return this;
	}

	applyNormalMatrix(m: { elements: number[] }): this {
		return this.applyMatrix3(m).normalize();
	}

	applyMatrix4(m: { elements: number[] }): this {
		const x = this._x, y = this._y, z = this._z;
		const e = m.elements;

		const w = 1 / (e[3]! * x + e[7]! * y + e[11]! * z + e[15]!);

		this._x = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) * w;
		this._y = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) * w;
		this._z = (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) * w;

		this._onChangeCallback();

		return this;
	}

	applyQuaternion(q: { x: number; y: number; z: number; w: number }): this {
		// quaternion q is assumed to have unit length

		const vx = this._x, vy = this._y, vz = this._z;
		const qx = q.x, qy = q.y, qz = q.z, qw = q.w;

		// t = 2 * cross( q.xyz, v );
		const tx = 2 * (qy * vz - qz * vy);
		const ty = 2 * (qz * vx - qx * vz);
		const tz = 2 * (qx * vy - qy * vx);

		// v + q.w * t + cross( q.xyz, t );
		this._x = vx + qw * tx + qy * tz - qz * ty;
		this._y = vy + qw * ty + qz * tx - qx * tz;
		this._z = vz + qw * tz + qx * ty - qy * tx;

		this._onChangeCallback();

		return this;
	}

	project(camera: Camera): this {
		return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
	}

	unproject(camera: Camera): this {
		return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
	}

	transformDirection(m: { elements: number[] }): this {
		// input: THREE.Matrix4 affine matrix
		// vector interpreted as a direction

		const x = this._x, y = this._y, z = this._z;
		const e = m.elements;

		this._x = e[0]! * x + e[4]! * y + e[8]! * z;
		this._y = e[1]! * x + e[5]! * y + e[9]! * z;
		this._z = e[2]! * x + e[6]! * y + e[10]! * z;

		// called by normalize?
		// this._onChangeCallback();

		return this.normalize();
	}

	divide(v: { x: number; y: number; z: number }): this {
		this._x /= v.x;
		this._y /= v.y;
		this._z /= v.z;
		this._onChangeCallback();
		return this;
	}

	divideScalar(scalar: number): this {
		return this.multiplyScalar(1 / scalar);
	}

	min(v: { x: number; y: number; z: number }): this {
		this._x = Math.min(this._x, v.x);
		this._y = Math.min(this._y, v.y);
		this._z = Math.min(this._z, v.z);
		this._onChangeCallback();
		return this;
	}

	max(v: { x: number; y: number; z: number }): this {
		this._x = Math.max(this._x, v.x);
		this._y = Math.max(this._y, v.y);
		this._z = Math.max(this._z, v.z);
		this._onChangeCallback();
		return this;
	}

	clamp(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }): this {
		// assumes min < max, componentwise

		this._x = Math.max(min.x, Math.min(max.x, this._x));
		this._y = Math.max(min.y, Math.min(max.y, this._y));
		this._z = Math.max(min.z, Math.min(max.z, this._z));

		this._onChangeCallback();

		return this;
	}

	clampScalar(minVal: number, maxVal: number): this {
		this._x = Math.max(minVal, Math.min(maxVal, this._x));
		this._y = Math.max(minVal, Math.min(maxVal, this._y));
		this._z = Math.max(minVal, Math.min(maxVal, this._z));

		this._onChangeCallback();

		return this;
	}

	clampLength(min: number, max: number): this {
		const length = this.length();

		return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
	}

	floor(): this {
		this._x = Math.floor(this._x);
		this._y = Math.floor(this._y);
		this._z = Math.floor(this._z);
		this._onChangeCallback();
		return this;
	}

	ceil(): this {
		this._x = Math.ceil(this._x);
		this._y = Math.ceil(this._y);
		this._z = Math.ceil(this._z);
		this._onChangeCallback();
		return this;
	}

	round(): this {
		this._x = Math.round(this._x);
		this._y = Math.round(this._y);
		this._z = Math.round(this._z);
		this._onChangeCallback();
		return this;
	}

	roundToZero(): this {
		this._x = Math.trunc(this._x);
		this._y = Math.trunc(this._y);
		this._z = Math.trunc(this._z);
		this._onChangeCallback();
		return this;
	}

	negate(): this {
		this._x = -this._x;
		this._y = -this._y;
		this._z = -this._z;
		this._onChangeCallback();
		return this;
	}

	dot(v: { x: number; y: number; z: number }): number {
		return this._x * v.x + this._y * v.y + this._z * v.z;
	}

	// TODO lengthSquared?

	lengthSq(): number {
		return this._x * this._x + this._y * this._y + this._z * this._z;
	}

	length(): number {
		return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z);
	}

	manhattanLength(): number {
		return Math.abs(this._x) + Math.abs(this._y) + Math.abs(this._z);
	}

	normalize(): this {
		return this.divideScalar(this.length() || 1);
	}

	setLength(length: number): this {
		return this.normalize().multiplyScalar(length);
	}

	lerp(v: { x: number; y: number; z: number }, alpha: number): this {
		this._x += (v.x - this._x) * alpha;
		this._y += (v.y - this._y) * alpha;
		this._z += (v.z - this._z) * alpha;
		this._onChangeCallback();
		return this;
	}

	lerpVectors(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }, alpha: number): this {
		this._x = v1.x + (v2.x - v1.x) * alpha;
		this._y = v1.y + (v2.y - v1.y) * alpha;
		this._z = v1.z + (v2.z - v1.z) * alpha;
		this._onChangeCallback();
		return this;
	}

	cross(v: { x: number; y: number; z: number }): this {
		return this.crossVectors(this, v);
	}

	crossVectors(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): this {
		const ax = a.x, ay = a.y, az = a.z;
		const bx = b.x, by = b.y, bz = b.z;

		this._x = ay * bz - az * by;
		this._y = az * bx - ax * bz;
		this._z = ax * by - ay * bx;

		this._onChangeCallback();

		return this;
	}

	projectOnVector(v: Vector3Enhanced | { x: number; y: number; z: number }): this {
		const isEnhanced = 'lengthSq' in v && 'dot' in v;
		const denominator = isEnhanced ? (v as Vector3Enhanced).lengthSq() : (v.x * v.x + v.y * v.y + v.z * v.z);

		if (denominator === 0) return this.set(0, 0, 0);

		const scalar = isEnhanced ? (v as Vector3Enhanced).dot(this) / denominator : this.dot(v) / denominator;

		return this.copy(v).multiplyScalar(scalar);
	}

	projectOnPlane(planeNormal: { x: number; y: number; z: number }): this {
		if (!_vector) _vector = new Vector3Enhanced();
		_vector.copy(this).projectOnVector(planeNormal);

		return this.sub(_vector);
	}

	reflect(normal: { x: number; y: number; z: number }): this {
		// reflect incident vector off plane orthogonal to normal
		// normal is assumed to have unit length
		if (!_vector) _vector = new Vector3Enhanced();
		return this.sub(_vector.copy(normal).multiplyScalar(2 * this.dot(normal)));
	}

	angleTo(v: { x: number; y: number; z: number }): number {
		const vLengthSq = v.x * v.x + v.y * v.y + v.z * v.z;
		const denominator = Math.sqrt(this.lengthSq() * vLengthSq);

		if (denominator === 0) return Math.PI / 2;

		const theta = this.dot(v) / denominator;

		// clamp, to handle numerical problems

		return Math.acos(MathUtils.clamp(theta, -1, 1));
	}

	distanceTo(v: { x: number; y: number; z: number }): number {
		return Math.sqrt(this.distanceToSquared(v));
	}

	distanceToSquared(v: { x: number; y: number; z: number }): number {
		const dx = this._x - v.x, dy = this._y - v.y, dz = this._z - v.z;

		return dx * dx + dy * dy + dz * dz;
	}

	manhattanDistanceTo(v: { x: number; y: number; z: number }): number {
		return Math.abs(this._x - v.x) + Math.abs(this._y - v.y) + Math.abs(this._z - v.z);
	}

	setFromSpherical(s: { radius: number; phi: number; theta: number }): this {
		return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
	}

	setFromSphericalCoords(radius: number, phi: number, theta: number): this {
		const sinPhiRadius = Math.sin(phi) * radius;

		this._x = sinPhiRadius * Math.sin(theta);
		this._y = Math.cos(phi) * radius;
		this._z = sinPhiRadius * Math.cos(theta);

		this._onChangeCallback();

		return this;
	}

	setFromCylindrical(c: { radius: number; theta: number; y: number }): this {
		return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
	}

	setFromCylindricalCoords(radius: number, theta: number, y: number): this {
		this._x = radius * Math.sin(theta);
		this._y = y;
		this._z = radius * Math.cos(theta);

		this._onChangeCallback();

		return this;
	}

	setFromMatrixPosition(m: { elements: number[] }): this {
		const e = m.elements;

		this._x = e[12]!;
		this._y = e[13]!;
		this._z = e[14]!;

		this._onChangeCallback();

		return this;
	}

	setFromMatrixScale(m: { elements: number[] }): this {
		const sx = this.setFromMatrixColumn(m, 0).length();
		const sy = this.setFromMatrixColumn(m, 1).length();
		const sz = this.setFromMatrixColumn(m, 2).length();

		this._x = sx;
		this._y = sy;
		this._z = sz;

		this._onChangeCallback();

		return this;
	}

	setFromMatrixColumn(m: { elements: number[] }, index: number): this {
		return this.fromArray(m.elements, index * 4);
	}

	setFromMatrix3Column(m: { elements: number[] }, index: number): this {
		return this.fromArray(m.elements, index * 3);
	}

	setFromEuler(e: { _x: number; _y: number; _z: number } | any): this {
		if ('_x' in e && '_y' in e && '_z' in e) {
			this._x = e._x;
			this._y = e._y;
			this._z = e._z;
		} else if ('x' in e && 'y' in e && 'z' in e) {
			this._x = e.x;
			this._y = e.y;
			this._z = e.z;
		}

		this._onChangeCallback();

		return this;
	}

	setFromColor(c: { r: number; g: number; b: number }): this {
		this._x = c.r;
		this._y = c.g;
		this._z = c.b;

		this._onChangeCallback();

		return this;
	}

	equals(v: { x: number; y: number; z: number }): boolean {
		return ((v.x === this._x) && (v.y === this._y) && (v.z === this._z));
	}

	fromArray(array: ArrayLike<number>, offset = 0): this {
		this._x = array[offset]!;
		this._y = array[offset + 1]!;
		this._z = array[offset + 2]!;

		this._onChangeCallback();

		return this;
	}

	toArray(): [number, number, number];
	toArray<TArray extends ArrayLike<number>>(array: TArray, offset?: number): TArray;
	toArray(array?: ArrayLike<number>, offset?: number): ArrayLike<number> | [number, number, number] {
		if (array === undefined) {
			return [this._x, this._y, this._z];
		}
		
		if (offset === undefined) offset = 0;
		
		(array as any)[offset] = this._x;
		(array as any)[offset + 1] = this._y;
		(array as any)[offset + 2] = this._z;
		
		return array;
	}

	fromBufferAttribute(attribute: BufferAttribute, index: number): this {
		this._x = attribute.getX(index);
		this._y = attribute.getY(index);
		this._z = attribute.getZ(index);

		this._onChangeCallback();

		return this;
	}

	random(): this {
		this._x = Math.random();
		this._y = Math.random();
		this._z = Math.random();

		this._onChangeCallback();

		return this;
	}

	randomDirection(): this {
		// https://mathworld.wolfram.com/SpherePointPicking.html

		const theta = Math.random() * Math.PI * 2;
		const u = Math.random() * 2 - 1;
		const c = Math.sqrt(1 - u * u);

		this._x = c * Math.cos(theta);
		this._y = u;
		this._z = c * Math.sin(theta);

		this._onChangeCallback();

		return this;
	}

	// PhysX extension methods
	fromPxVec3(pxVec3: any): this {
		this._x = pxVec3.x;
		this._y = pxVec3.y;
		this._z = pxVec3.z;
		this._onChangeCallback();
		return this;
	}

	toPxVec3(pxVec3?: any): any {
		if (!pxVec3 && typeof PHYSX !== 'undefined') {
			pxVec3 = new PHYSX.PxVec3();
		}
		if (pxVec3) {
			pxVec3.x = this._x;
			pxVec3.y = this._y;
			pxVec3.z = this._z;
		}
		return pxVec3;
	}

	toPxExtVec3(pxExtVec3?: any): any {
		if (!pxExtVec3 && typeof PHYSX !== 'undefined') {
			pxExtVec3 = new PHYSX.PxExtendedVec3();
		}
		if (pxExtVec3) {
			pxExtVec3.x = this._x;
			pxExtVec3.y = this._y;
			pxExtVec3.z = this._z;
		}
		return pxExtVec3;
	}

	toPxTransform(pxTransform: any): void {
		if (pxTransform && pxTransform.p) {
			pxTransform.p.x = this._x;
			pxTransform.p.y = this._y;
			pxTransform.p.z = this._z;
		}
	}

	_onChange(callback: () => void): this {
		this._onChangeCallback = callback;
		return this;
	}

	_onChangeCallback() {}

	*[Symbol.iterator]() {
		yield this._x;
		yield this._y;
		yield this._z;
	}
}

// export { Vector3 };