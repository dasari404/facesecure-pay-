import { FaceLandmarker as e, FilesetResolver as t } from "@mediapipe/tasks-vision";
import * as n from "onnxruntime-web";
//#region src/preprocess.ts
function r(e, t) {
	return e === "NHWC" ? [
		1,
		t,
		t,
		3
	] : [
		1,
		3,
		t,
		t
	];
}
function i(e) {
	return typeof e == "number" ? [
		e,
		e,
		e
	] : e;
}
function a(e) {
	if (!Number.isInteger(e) || e < 1 || e > 8192) throw Error(`Invalid model inputSize ${e}: expected an integer in [1, 8192].`);
	return e;
}
function o(e, t) {
	let { data: n } = e, r = t.inputSize * t.inputSize, i = new Float32Array(3 * r), a = t.channelOrder === "BGR" ? [
		2,
		1,
		0
	] : [
		0,
		1,
		2
	], o = t.layout !== "NHWC", { mean: s, std: c } = t;
	for (let e = 0; e < r; e++) for (let t = 0; t < 3; t++) {
		let l = (n[e * 4 + a[t]] - s[t]) / c[t];
		i[o ? t * r + e : e * 3 + t] = l;
	}
	return i;
}
//#endregion
//#region src/embed.ts
var s = {
	inputSize: 112,
	layout: "NCHW",
	channelOrder: "RGB",
	mean: [
		127.5,
		127.5,
		127.5
	],
	std: [
		127.5,
		127.5,
		127.5
	],
	l2normalize: !0,
	metric: "cosine"
};
function c(e = {}) {
	return {
		inputSize: a(e.inputSize ?? s.inputSize),
		layout: e.layout ?? s.layout,
		channelOrder: e.channelOrder ?? s.channelOrder,
		mean: e.mean === void 0 ? s.mean : i(e.mean),
		std: e.std === void 0 ? s.std : i(e.std),
		l2normalize: e.l2normalize ?? s.l2normalize,
		metric: e.metric ?? s.metric
	};
}
function l(e) {
	let t = 0;
	for (let n of e) t += n * n;
	if (t = Math.sqrt(t), t < 1e-10) return e;
	for (let n = 0; n < e.length; n++) e[n] /= t;
	return e;
}
function u(e, t) {
	let n = 0, r = 0, i = 0;
	for (let a = 0; a < e.length; a++) n += e[a] * t[a], r += e[a] * e[a], i += t[a] * t[a];
	let a = Math.sqrt(r) * Math.sqrt(i);
	return a < 1e-10 ? 1 : 1 - n / a;
}
function d(e, t) {
	let n = 0;
	for (let r = 0; r < e.length; r++) {
		let i = e[r] - t[r];
		n += i * i;
	}
	return Math.sqrt(n);
}
function f(e, t, n = "cosine") {
	return n === "euclidean" ? d(e, t) : u(e, t);
}
async function p(e, t, i = s) {
	let a = o(t, i), c = e.inputNames[0], u = new n.Tensor("float32", a, r(i.layout, i.inputSize)), d = await e.run({ [c]: u }), f = e.outputNames[0], p = new Float32Array(d[f].data);
	return i.l2normalize ? l(p) : p;
}
//#endregion
//#region src/liveness.ts
var m = {
	inputSize: 80,
	layout: "NCHW",
	channelOrder: "BGR",
	mean: [
		0,
		0,
		0
	],
	std: [
		1,
		1,
		1
	],
	cropScale: 2.7,
	liveClassIndex: 1,
	applySoftmax: !0
};
function h(e = {}) {
	return {
		inputSize: a(e.inputSize ?? m.inputSize),
		layout: e.layout ?? m.layout,
		channelOrder: e.channelOrder ?? m.channelOrder,
		mean: e.mean === void 0 ? m.mean : i(e.mean),
		std: e.std === void 0 ? m.std : i(e.std),
		cropScale: e.cropScale ?? m.cropScale,
		liveClassIndex: e.liveClassIndex ?? m.liveClassIndex,
		applySoftmax: e.applySoftmax ?? m.applySoftmax
	};
}
/* v8 ignore start */
function g(e, t, n = m.cropScale, r = m.inputSize) {
	let { width: i, height: a } = e, o = Infinity, s = -Infinity, c = Infinity, l = -Infinity;
	for (let e of t) e.x < o && (o = e.x), e.x > s && (s = e.x), e.y < c && (c = e.y), e.y > l && (l = e.y);
	let u = (s - o) * i, d = (l - c) * a, f = (o + s) / 2 * i, p = (c + l) / 2 * a, h = Math.max(u, d) * n / 2, g = Math.round(Math.max(0, f - h)), _ = Math.round(Math.max(0, p - h)), v = Math.round(Math.min(i, f + h)), y = Math.round(Math.min(a, p + h)), b = v - g, x = y - _, S = new OffscreenCanvas(i, a);
	S.getContext("2d").putImageData(e, 0, 0);
	let C = new OffscreenCanvas(r, r).getContext("2d");
	return C.drawImage(S, g, _, b, x, 0, 0, r, r), C.getImageData(0, 0, r, r);
}
/* v8 ignore stop */
async function _(e, t, i = m) {
	let a = o(t, i), s = e.inputNames[0], c = new n.Tensor("float32", a, r(i.layout, i.inputSize)), l = await e.run({ [s]: c }), u = Array.from(l[e.outputNames[0]].data);
	if (!i.applySoftmax) return u[i.liveClassIndex];
	let d = Math.max(...u), f = u.map((e) => Math.exp(e - d)), p = f.reduce((e, t) => e + t, 0);
	return f[i.liveClassIndex] / p;
}
//#endregion
//#region src/models.ts
var v = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm", y = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/", b = null, x = null, S = [], C = s, w = [];
function T(e) {
	return {
		width: e,
		height: e,
		data: new Uint8ClampedArray(e * e * 4)
	};
}
function E(e) {
	return e == null ? [] : Array.isArray(e) ? e : [e];
}
function D(e, t) {
	return e.map((e, n) => h(Array.isArray(t) ? t[n] : t));
}
async function O(i = {}) {
	let { faceLandmarkerPath: a = "models/face_landmarker.task", recognitionModelPath: s = "models/mobilefacenet.onnx", livenessModelPath: l, wasmBasePath: u, warmup: d = !0, recognition: f, liveness: p } = i, m = E(l);
	if (C = c(f), w = D(m, p), n.env.wasm.wasmPaths = u ?? y, n.env.wasm.numThreads = 1, !b) {
		let n = await t.forVisionTasks(u ?? v);
		b = await e.createFromOptions(n, {
			baseOptions: {
				modelAssetPath: a,
				delegate: "GPU"
			},
			runningMode: "IMAGE",
			numFaces: 10,
			outputFaceBlendshapes: !1,
			outputFacialTransformationMatrixes: !1
		});
	}
	if (x ||= await n.InferenceSession.create(s, { executionProviders: ["wasm"] }), S.length === 0 && m.length > 0 && (S = await Promise.all(m.map((e) => n.InferenceSession.create(e, { executionProviders: ["wasm"] })))), d) {
		let e = C, t = o(T(e.inputSize), e);
		await x.run({ [x.inputNames[0]]: new n.Tensor("float32", t, r(e.layout, e.inputSize)) });
		for (let e = 0; e < S.length; e++) {
			let t = w[e], i = o(T(t.inputSize), t);
			await S[e].run({ [S[e].inputNames[0]]: new n.Tensor("float32", i, r(t.layout, t.inputSize)) });
		}
	}
}
function k() {
	if (!b || !x) throw Error("Models not loaded. Call loadModels() first.");
	return {
		faceLandmarker: b,
		session: x,
		livenessSessions: S,
		recognitionConfig: C,
		livenessConfigs: w
	};
}
//#endregion
//#region src/image.ts
var A = [
	"http",
	"https",
	"data",
	"blob"
];
function j(e) {
	let t = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(e)?.[1].toLowerCase();
	if (t && !A.includes(t)) throw Error(`Unsupported image source scheme "${t}:". Allowed: ${A.join(", ")}, or a relative path.`);
}
/* v8 ignore start */
async function M(e) {
	if (e instanceof ImageData) return e;
	let t;
	if (typeof e == "string") {
		j(e);
		let n = await fetch(e);
		if (!n.ok) throw Error(`Failed to fetch image: ${n.status} ${e}`);
		let r = await n.blob();
		t = await createImageBitmap(r);
	} else t = await createImageBitmap(e);
	let n = new OffscreenCanvas(t.width, t.height).getContext("2d");
	n.drawImage(t, 0, 0);
	let r = n.getImageData(0, 0, t.width, t.height);
	return t.close(), r;
}
function N(e) {
	let t = document.createElement("canvas");
	return t.width = e.width, t.height = e.height, t.getContext("2d").putImageData(e, 0, 0), t;
}
/* v8 ignore stop */
//#endregion
//#region src/detect.ts
function P(e, t) {
	let n = N(t);
	return e.detect(n).faceLandmarks.map((e) => ({
		landmarks: e,
		boundingBoxArea: F(e)
	})).sort((e, t) => t.boundingBoxArea - e.boundingBoxArea);
}
function F(e) {
	let t = Infinity, n = -Infinity, r = Infinity, i = -Infinity;
	for (let a of e) a.x < t && (t = a.x), a.x > n && (n = a.x), a.y < r && (r = a.y), a.y > i && (i = a.y);
	return (n - t) * (i - r);
}
//#endregion
//#region src/align.ts
var I = [
	[38.2946, 51.6963],
	[73.5318, 51.5014],
	[56.0252, 71.7366],
	[41.5493, 92.3655],
	[70.7299, 92.2041]
];
function L(e, t, n) {
	let r = (e) => [e.x * t, e.y * n], i = e.length >= 478;
	return [
		i ? r(e[468]) : R(r(e[33]), r(e[133])),
		i ? r(e[473]) : R(r(e[263]), r(e[362])),
		r(e[1]),
		r(e[61]),
		r(e[291])
	];
}
function R(e, t) {
	return [(e[0] + t[0]) / 2, (e[1] + t[1]) / 2];
}
function z(e, t) {
	let n = e.length, r = 0, i = 0, a = 0, o = 0;
	for (let s = 0; s < n; s++) r += e[s][0], i += e[s][1], a += t[s][0], o += t[s][1];
	r /= n, i /= n, a /= n, o /= n;
	let s = 0;
	for (let t = 0; t < n; t++) {
		let n = e[t][0] - r, a = e[t][1] - i;
		s += n * n + a * a;
	}
	s /= n;
	let c = 0, l = 0, u = 0, d = 0;
	for (let s = 0; s < n; s++) {
		let n = e[s][0] - r, f = e[s][1] - i, p = t[s][0] - a, m = t[s][1] - o;
		c += p * n, l += p * f, u += m * n, d += m * f;
	}
	c /= n, l /= n, u /= n, d /= n;
	let { u: f, s: p, vt: m } = B(c, l, u, d), h = (f[0] * f[3] - f[1] * f[2]) * (m[0] * m[3] - m[1] * m[2]) < 0 ? -1 : 1, g = f[0] * m[0] + f[1] * h * m[2], _ = f[0] * m[1] + f[1] * h * m[3], v = f[2] * m[0] + f[3] * h * m[2], y = f[2] * m[1] + f[3] * h * m[3], b = (p[0] + p[1] * h) / s, x = a - b * (g * r + _ * i), S = o - b * (v * r + y * i);
	return [
		b * g,
		b * _,
		x,
		b * v,
		b * y,
		S
	];
}
function B(e, t, n, r) {
	let i = e * e + n * n, a = e * t + n * r, o = t * t + r * r, s = (i - o) * .5, c = Math.sqrt(s * s + a * a), l = (i + o) * .5 + c, u = (i + o) * .5 - c, d = Math.sqrt(Math.max(0, l)), f = Math.sqrt(Math.max(0, u)), p, m, h, g;
	if (Math.abs(a) < 1e-10) i >= o ? (p = 1, m = 0, h = 0, g = 1) : (p = 0, m = 1, h = 1, g = 0);
	else {
		let e = a, t = l - i, n = Math.sqrt(e * e + t * t);
		p = e / n, m = t / n, h = -m, g = p;
	}
	let _, v, y, b;
	return d > 1e-10 ? (_ = (e * p + t * m) / d, v = (n * p + r * m) / d) : (_ = 1, v = 0), f > 1e-10 ? (y = (e * h + t * g) / f, b = (n * h + r * g) / f) : (y = -v, b = _), {
		u: [
			_,
			y,
			v,
			b
		],
		s: [d, f],
		vt: [
			p,
			m,
			h,
			g
		]
	};
}
/* v8 ignore start */
function V(e, t, n = 112) {
	let r = n / 112, [i, a, o, s, c, l] = z(t, r === 1 ? I : I.map(([e, t]) => [e * r, t * r])), u = new OffscreenCanvas(e.width, e.height);
	u.getContext("2d").putImageData(e, 0, 0);
	let d = new OffscreenCanvas(n, n).getContext("2d");
	return d.setTransform(i, s, a, c, o, l), d.drawImage(u, 0, 0), d.getImageData(0, 0, n, n);
}
/* v8 ignore stop */
//#endregion
//#region src/compare.ts
var H = .5, U = .8;
function W(e, t, n, r) {
	return {
		match: !1,
		confidence: 0,
		flags: e,
		details: {
			baselineFacesFound: t,
			currentFacesFound: n,
			distance: 1,
			threshold: r
		}
	};
}
async function G(e, t, n = {}) {
	let r = n.threshold ?? .5, i = n.livenessThreshold ?? .5, { faceLandmarker: a, session: o, livenessSessions: s, recognitionConfig: c, livenessConfigs: l } = k();
	if (n.checkLiveness === !0 && s.length === 0) throw Error("checkLiveness:true but no liveness model is loaded. Pass livenessModelPath to loadModels().");
	let u = n.checkLiveness ?? s.length > 0, [d, m] = await Promise.all([M(e), M(t)]), h = P(a, d), v = P(a, m), y = [];
	if (h.length === 0) return y.push("baseline_missing"), W(y, 0, v.length, r);
	h.length > 1 && y.push("baseline_ambiguous");
	let b = h[0];
	if (v.length === 0) return y.push("face_missing"), W(y, h.length, 0, r);
	v.length > 1 && y.push("multiple_faces");
	let x = await p(o, V(d, L(b.landmarks, d.width, d.height), c.inputSize), c), S = Infinity, C = v[0].landmarks;
	for (let e of v) {
		let t = f(x, await p(o, V(m, L(e.landmarks, m.width, m.height), c.inputSize), c), c.metric);
		t < S && (S = t, C = e.landmarks);
	}
	let w;
	if (u && s.length > 0) {
		let e = 0;
		for (let t = 0; t < s.length; t++) {
			let n = l[t], r = g(m, C, n.cropScale, n.inputSize);
			e += await _(s[t], r, n);
		}
		w = e / s.length, w < i && y.push("liveness_fail");
	}
	let T = S <= r && (!u || w !== void 0 && w >= i);
	return S > r && y.push("identity_mismatch"), T && S > U * r && y.push("low_confidence"), {
		match: T,
		confidence: Math.max(0, 1 - S / r),
		flags: y,
		details: {
			baselineFacesFound: h.length,
			currentFacesFound: v.length,
			distance: S,
			threshold: r,
			livenessScore: w
		}
	};
}
//#endregion
export { H as DEFAULT_THRESHOLD, G as compareFaces, O as loadModels };
