import { Component as e } from "react";
import { create as t } from "zustand";
import { produce as n } from "immer";
//#region \0rolldown/runtime.js
var r = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), i = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
}), a = t((e) => ({
	diagnoses: [],
	currentDiagnosis: null,
	loading: !1,
	addDiagnosis: (t) => e((e) => ({
		diagnoses: [...e.diagnoses, {
			...t,
			timestamp: Date.now()
		}],
		currentDiagnosis: {
			...t,
			timestamp: Date.now()
		}
	})),
	setCurrentDiagnosis: (t) => e({ currentDiagnosis: t ? {
		...t,
		timestamp: Date.now()
	} : null }),
	clearDiagnoses: () => ({
		diagnoses: [],
		currentDiagnosis: null
	}),
	setLoading: (t) => e({ loading: t })
})), o = t((e) => ({
	isRecovering: !1,
	lastRecoveredState: null,
	recoveryCount: 0,
	autoRecovery: !1,
	setAutoRecovery: (t) => e({ autoRecovery: t }),
	setIsRecovering: (t) => e({ isRecovering: t }),
	setRecoveredState: (t) => e({ lastRecoveredState: t }),
	incrementRecoveryCount: () => e((e) => ({ recoveryCount: e.recoveryCount + 1 }))
})), s = (e) => (t, r, i) => (i.setState = (e, r, ...i) => t(typeof e == "function" ? n(e) : e, r, ...i), e(i.setState, r, i)), c = [
	"name",
	"email",
	"address",
	"phone",
	"message"
], l = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, u = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/, d = [
	{
		name: "TYPE_INTEGRITY",
		check: (e) => {
			let t = e.form;
			if (!t || typeof t != "object") return {
				passed: !1,
				detail: "form missing or not an object"
			};
			for (let e of c) if (typeof t[e] != "string") return {
				passed: !1,
				detail: `field "${e}" is ${t[e] === null ? "null" : typeof t[e]}, expected string`
			};
			return { passed: !0 };
		}
	},
	{
		name: "EMAIL_FORMAT",
		check: (e) => {
			let t = e.form?.email;
			return typeof t == "string" ? t === "" || l.test(t) ? { passed: !0 } : {
				passed: !1,
				detail: `email "${t.slice(0, 40)}" does not match required format`
			} : {
				passed: !1,
				detail: "email not a string"
			};
		}
	},
	{
		name: "SCHEMA_KEYS",
		check: (e) => {
			let t = e.form;
			if (!t) return {
				passed: !1,
				detail: "form missing"
			};
			let n = Object.keys(t).sort(), r = [...c].sort(), i = n.filter((e) => !r.includes(e)), a = r.filter((e) => !n.includes(e));
			return i.length || a.length ? {
				passed: !1,
				detail: `extra=[${i}] missing=[${a}]`
			} : { passed: !0 };
		}
	},
	{
		name: "CONTROL_CHARS",
		check: (e) => {
			let t = e.form;
			if (!t) return {
				passed: !1,
				detail: "form missing"
			};
			for (let e of c) {
				let n = t[e];
				if (typeof n == "string" && u.test(n)) return {
					passed: !1,
					detail: `field "${e}" contains control characters`
				};
			}
			return { passed: !0 };
		}
	}
], f = {
	RING_BOUND: (e, t = 50) => ({
		name: "RING_BOUND",
		passed: e <= t,
		detail: e <= t ? void 0 : `${e} > ${t}`
	}),
	TIMESTAMP_MONOTONIC: (e) => {
		for (let t = 1; t < e.length; t++) if (e[t] < e[t - 1]) return {
			name: "TIMESTAMP_MONOTONIC",
			passed: !1,
			detail: `snapshot ${t} older than ${t - 1}`
		};
		return {
			name: "TIMESTAMP_MONOTONIC",
			passed: !0
		};
	}
};
function p(e) {
	return d.map((t) => {
		try {
			let n = t.check(e);
			return {
				name: t.name,
				passed: n.passed,
				detail: n.detail
			};
		} catch (e) {
			return {
				name: t.name,
				passed: !1,
				detail: `checker threw: ${e?.message}`
			};
		}
	});
}
function m(e) {
	return e.every((e) => e.passed);
}
function h(e) {
	return e.find((e) => !e.passed) ?? null;
}
//#endregion
//#region src/core/ErrorDetector.ts
var g = [
	"RENDER_CRASH",
	"EVENT_HANDLER",
	"ASYNC_TIMEOUT",
	"UNHANDLED_REJECTION",
	"SCRIPT_ERROR",
	"NETWORK",
	"STATE_INVARIANT",
	"MULTI_TAB"
], _ = {
	RENDER_CRASH: "Thrown while React renders a component (caught by the error boundary)",
	EVENT_HANDLER: "Thrown synchronously inside a UI event handler",
	ASYNC_TIMEOUT: "Thrown from setTimeout / async timer callback",
	UNHANDLED_REJECTION: "Promise rejection with no catch handler",
	SCRIPT_ERROR: "Thrown by third-party or injected script code",
	NETWORK: "Fetch / resource request failed",
	STATE_INVARIANT: "Application state violated a consistency invariant",
	MULTI_TAB: "Form state recovered from another browser tab"
}, v = 0, y = () => `err-${Date.now()}-${(v++).toString(36)}`, b = t((e, t) => ({
	activeError: null,
	errorHistory: [],
	report: (n) => {
		if (t().activeError) return;
		let r = {
			...n,
			id: y(),
			at: Date.now()
		};
		e((e) => ({
			activeError: r,
			errorHistory: [...e.errorHistory.slice(-99), r]
		}));
	},
	clearActive: () => e({ activeError: null })
})), x = (e) => b.getState().report(e), S = () => b.getState().clearActive();
function C(e, t, n = "error") {
	let r = e.toLowerCase(), i = (t || "").toLowerCase();
	return r.includes("network") || r.includes("failed to fetch") || r.includes("load failed") || r.includes("dns") || r.includes("err_unsafe_port") || r.includes("connection refused") ? "NETWORK" : n === "rejection" ? "UNHANDLED_REJECTION" : i.includes("injectsafesettimeout") || i.includes("eventhandler") || i.includes("invokeeventhandlers") || i.includes("react") && (i.includes("dispatch") || i.includes("event")) ? "EVENT_HANDLER" : "SCRIPT_ERROR";
}
var w = !1;
function T() {
	if (w || typeof window > "u") return () => {};
	w = !0;
	let e = (e) => {
		let t = e.message || String(e.error || "Unknown error"), n = e.error?.stack || void 0;
		x({
			errorClass: C(t, n, "error"),
			message: t,
			stack: n,
			source: "window"
		});
	}, t = (e) => {
		let t = e.reason, n = t?.message || String(t);
		x({
			errorClass: C(n, t?.stack, "rejection"),
			message: n,
			stack: t?.stack,
			source: "rejection"
		});
	};
	return window.addEventListener("error", e), window.addEventListener("unhandledrejection", t), () => {
		window.removeEventListener("error", e), window.removeEventListener("unhandledrejection", t), w = !1;
	};
}
//#endregion
//#region src/core/SnapshotManager.ts
var E = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, D = t()(s((e, t) => ({
	snapshots: [],
	recoveryLogs: [],
	form: {
		name: "",
		email: "",
		address: "",
		phone: "",
		message: ""
	},
	isSubmitting: !1,
	addSnapshot: (n) => {
		let r = t().getLatestSnapshot();
		r && JSON.stringify(r.state) === JSON.stringify(n) || e((e) => {
			let t = {
				state: JSON.parse(JSON.stringify(n)),
				timestamp: Date.now(),
				id: E()
			};
			e.snapshots.push(t), e.snapshots.length > 50 && e.snapshots.shift();
		});
	},
	getLatestSnapshot: () => {
		let e = t().snapshots;
		return e.length > 0 ? e[e.length - 1] : null;
	},
	addLog: (t) => e((e) => {
		e.recoveryLogs.push({
			...t,
			id: E(),
			timestamp: Date.now()
		});
	}),
	addRecoveryLog: (t) => {
		e((e) => {
			e.recoveryLogs.push({
				...t,
				id: E(),
				timestamp: Date.now()
			});
		});
	},
	clearLogs: () => e((e) => {
		e.recoveryLogs = [];
	}),
	takeSnapshot: (e) => {
		let n = { form: e }, r = p(n);
		if (!m(r)) {
			let e = h(r);
			t().addLog({
				type: "error",
				message: `CHECKPOINT REJECTED - invariant ${e.name} violated: ${e.detail}`
			});
			return;
		}
		t().addSnapshot(n), t().addLog({
			type: "snapshot",
			message: `STATE SNAPSHOT - Size: ${JSON.stringify(n).length} bytes`,
			stateSize: JSON.stringify(n).length
		});
	},
	updateForm: (t) => e((e) => {
		e.form = {
			...e.form,
			...t
		};
	}),
	setSubmitting: (t) => e({ isSubmitting: t }),
	restoreSnapshot: (n) => {
		let r = t().snapshots.find((e) => e.id === n);
		if (!r) {
			t().addLog({
				type: "error",
				message: "Selected checkpoint is no longer available"
			});
			return;
		}
		t().addLog({
			type: "recovery",
			message: `TIME TRAVEL: Restoring checkpoint from ${new Date(r.timestamp).toLocaleTimeString()}`
		}), e((e) => {
			let t = r.state;
			e.form = { ...t?.form ?? t }, e.isSubmitting = !1;
		}), t().addLog({
			type: "success",
			message: `Restored checkpoint from ${new Date(r.timestamp).toLocaleTimeString()}`
		});
	},
	restoreFromSnapshot: () => {
		let e = t().getLatestSnapshot();
		if (!e) {
			t().addLog({
				type: "error",
				message: "No snapshot available for recovery"
			});
			return;
		}
		t().restoreSnapshot(e.id);
	}
}))), O = (e) => {
	let t = D.getState(), n = p(e);
	if (!m(n)) {
		let e = h(n);
		return x({
			errorClass: "STATE_INVARIANT",
			message: `Checkpoint rejected - invariant ${e.name} violated: ${e.detail}`,
			source: "report"
		}), t.addLog({
			type: "error",
			message: `CHECKPOINT REJECTED - invariant ${e.name} violated: ${e.detail}`
		}), !1;
	}
	t.addSnapshot(e);
	let r = JSON.stringify(e).length;
	return t.addLog({
		type: "snapshot",
		message: `STATE SNAPSHOT - Size: ${r} bytes`,
		stateSize: r
	}), !0;
}, k = () => D.getState().getLatestSnapshot(), A = (e) => {
	D.getState().addLog(e);
}, j = (e) => D.getState().setSubmitting(e), M = () => D.getState().restoreFromSnapshot(), N = () => D.getState().form;
//#endregion
//#region src/core/Certificate.ts
function P(e) {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = (t << 5) + t + e.charCodeAt(n) | 0;
	return (t >>> 0).toString(16).padStart(8, "0");
}
function F(e) {
	if (typeof e != "object" || !e) return JSON.stringify(e) ?? "null";
	if (Array.isArray(e)) return `[${e.map(F).join(",")}]`;
	let t = e;
	return `{${Object.keys(t).filter((e) => t[e] !== void 0).sort().map((e) => `${JSON.stringify(e)}:${F(t[e])}`).join(",")}}`;
}
function I(e) {
	return P(F(e));
}
function L(e) {
	return F(e);
}
function R(e) {
	let t = p(e.postState), n = I(e.postState), r = Date.now(), i = {
		id: `cert-${r}-${Math.random().toString(36).slice(2, 9)}`,
		issuedAt: r,
		errorClass: e.errorClass,
		errorMessage: e.errorMessage.slice(0, 500),
		preStateHash: I(e.preState),
		postStateHash: n,
		snapshotId: e.snapshotId,
		snapshotTimestamp: e.snapshotTimestamp,
		lossWindowMs: Math.max(0, (e.detectedAt ?? r) - e.snapshotTimestamp),
		recoveryDurationMs: Number(e.recoveryDurationMs.toFixed(3)),
		invariants: t,
		verified: m(t)
	};
	return {
		...i,
		certificateHash: P(L(i))
	};
}
function z(e, t) {
	let n = [], { certificateHash: r, ...i } = e;
	P(F(i)) !== r && n.push("certificateHash does not match certificate body (tampered?)");
	let a = (e.invariants || []).filter((e) => !e.passed);
	if (a.length && n.push(`invariants failed: ${a.map((e) => `${e.name}(${e.detail ?? ""})`).join(", ")}`), e.verified || n.push("certificate was issued with verified=false"), (e.invariants || []).length === 0 && n.push("certificate records no invariant results"), t !== void 0) {
		I(t) !== e.postStateHash && n.push("postStateHash does not match the provided state");
		let r = p(t).filter((e) => !e.passed);
		r.length && n.push(`re-run invariants failed: ${r.map((e) => e.name).join(", ")}`);
	}
	return {
		valid: n.length === 0,
		reasons: n
	};
}
var B = t((e) => ({
	certificates: [],
	addCertificate: (t) => e((e) => ({ certificates: [...e.certificates, t] })),
	clear: () => e({ certificates: [] })
})), V = () => JSON.stringify(B.getState().certificates, null, 2), H = /* @__PURE__ */ r(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), ee = /* @__PURE__ */ r(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t(e) {
			if (e == null) return null;
			if (typeof e == "function") return e.$$typeof === A ? null : e.displayName || e.name || null;
			if (typeof e == "string") return e;
			switch (e) {
				case v: return "Fragment";
				case b: return "Profiler";
				case y: return "StrictMode";
				case w: return "Suspense";
				case T: return "SuspenseList";
				case O: return "Activity";
				case k: return "ViewTransition";
			}
			if (typeof e == "object") switch (typeof e.tag == "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), e.$$typeof) {
				case _: return "Portal";
				case S: return e.displayName || "Context";
				case x: return (e._context.displayName || "Context") + ".Consumer";
				case C:
					var n = e.render;
					return e = e.displayName, e ||= (e = n.displayName || n.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
				case E: return n = e.displayName || null, n === null ? t(e.type) || "Memo" : n;
				case D:
					n = e._payload, e = e._init;
					try {
						return t(e(n));
					} catch {}
			}
			return null;
		}
		function n(e) {
			return "" + e;
		}
		function r(e) {
			try {
				n(e);
				var t = !1;
			} catch {
				t = !0;
			}
			if (t) {
				t = console;
				var r = t.error, i = typeof Symbol == "function" && Symbol.toStringTag && e[Symbol.toStringTag] || e.constructor.name || "Object";
				return r.call(t, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", i), n(e);
			}
		}
		function a(e) {
			if (e === v) return "<>";
			if (typeof e == "object" && e && e.$$typeof === D) return "<...>";
			try {
				var n = t(e);
				return n ? "<" + n + ">" : "<...>";
			} catch {
				return "<...>";
			}
		}
		function o() {
			var e = j.A;
			return e === null ? null : e.getOwner();
		}
		function s() {
			return Error("react-stack-top-frame");
		}
		function c(e) {
			if (M.call(e, "key")) {
				var t = Object.getOwnPropertyDescriptor(e, "key").get;
				if (t && t.isReactWarning) return !1;
			}
			return e.key !== void 0;
		}
		function l(e, t) {
			function n() {
				F || (F = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", t));
			}
			n.isReactWarning = !0, Object.defineProperty(e, "key", {
				get: n,
				configurable: !0
			});
		}
		function u() {
			var e = t(this.type);
			return I[e] || (I[e] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.")), e = this.props.ref, e === void 0 ? null : e;
		}
		function d(e, t, n, r, i, a) {
			var o = n.ref;
			return e = {
				$$typeof: g,
				type: e,
				key: t,
				props: n,
				_owner: r
			}, (o === void 0 ? null : o) === null ? Object.defineProperty(e, "ref", {
				enumerable: !1,
				value: null
			}) : Object.defineProperty(e, "ref", {
				enumerable: !1,
				get: u
			}), e._store = {}, Object.defineProperty(e._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			}), Object.defineProperty(e, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			}), Object.defineProperty(e, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: i
			}), Object.defineProperty(e, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: a
			}), Object.freeze && (Object.freeze(e.props), Object.freeze(e)), e;
		}
		function f(e, n, i, a, s, u) {
			var f = n.children;
			if (f !== void 0) {
				if (a) {
					if (N(f)) {
						for (a = 0; a < f.length; a++) p(f[a]);
						Object.freeze && Object.freeze(f);
					} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
				} else p(f);
			}
			if (M.call(n, "key")) {
				f = t(e);
				var m = Object.keys(n).filter(function(e) {
					return e !== "key";
				});
				a = 0 < m.length ? "{key: someKey, " + m.join(": ..., ") + ": ...}" : "{key: someKey}", z[f + a] || (m = 0 < m.length ? "{" + m.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", a, f, m, f), z[f + a] = !0);
			}
			if (f = null, i !== void 0 && (r(i), f = "" + i), c(n) && (r(n.key), f = "" + n.key), "key" in n) for (var h in i = {}, n) h !== "key" && (i[h] = n[h]);
			else i = n;
			return f && l(i, typeof e == "function" ? e.displayName || e.name || "Unknown" : e), d(e, f, i, o(), s, u);
		}
		function p(e) {
			m(e) ? e._store && (e._store.validated = 1) : typeof e == "object" && e && e.$$typeof === D && (e._payload.status === "fulfilled" ? m(e._payload.value) && e._payload.value._store && (e._payload.value._store.validated = 1) : e._store && (e._store.validated = 1));
		}
		function m(e) {
			return typeof e == "object" && !!e && e.$$typeof === g;
		}
		var h = i("react"), g = Symbol.for("react.transitional.element"), _ = Symbol.for("react.portal"), v = Symbol.for("react.fragment"), y = Symbol.for("react.strict_mode"), b = Symbol.for("react.profiler"), x = Symbol.for("react.consumer"), S = Symbol.for("react.context"), C = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), T = Symbol.for("react.suspense_list"), E = Symbol.for("react.memo"), D = Symbol.for("react.lazy"), O = Symbol.for("react.activity"), k = Symbol.for("react.view_transition"), A = Symbol.for("react.client.reference"), j = h.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, M = Object.prototype.hasOwnProperty, N = Array.isArray, P = console.createTask ? console.createTask : function() {
			return null;
		};
		h = { react_stack_bottom_frame: function(e) {
			return e();
		} };
		var F, I = {}, L = h.react_stack_bottom_frame.bind(h, s)(), R = P(a(s)), z = {};
		e.Fragment = v, e.jsx = function(e, t, n) {
			var r = 1e4 > j.recentlyCreatedOwnerStacks++;
			if (r) {
				var i = Error.stackTraceLimit;
				Error.stackTraceLimit = 10;
				var o = Error("react-stack-top-frame");
				Error.stackTraceLimit = i;
			} else o = L;
			return f(e, t, n, !1, o, r ? P(a(e)) : R);
		}, e.jsxs = function(e, t, n) {
			var r = 1e4 > j.recentlyCreatedOwnerStacks++;
			if (r) {
				var i = Error.stackTraceLimit;
				Error.stackTraceLimit = 10;
				var o = Error("react-stack-top-frame");
				Error.stackTraceLimit = i;
			} else o = L;
			return f(e, t, n, !0, o, r ? P(a(e)) : R);
		};
	})();
})), U = (/* @__PURE__ */ r(((e, t) => {
	t.exports = process.env.NODE_ENV === "production" ? H() : ee();
})))(), te = class extends e {
	unsubscribeDetector = null;
	constructor(e) {
		super(e), this.state = {
			hasError: !1,
			error: null,
			errorInfo: null,
			errorClass: null,
			detectedAt: null,
			diagnosis: null,
			diagnosisLoading: !1
		};
	}
	static getDerivedStateFromError(e) {
		return {
			hasError: !0,
			error: e,
			errorInfo: null,
			errorClass: "RENDER_CRASH",
			detectedAt: Date.now(),
			diagnosis: null,
			diagnosisLoading: !1
		};
	}
	componentDidMount() {
		this.unsubscribeDetector = b.subscribe((e) => {
			let t = e.activeError;
			if (!t || this.state.hasError) return;
			let n = Error(t.message);
			this.setState({
				hasError: !0,
				error: n,
				errorInfo: null,
				errorClass: t.errorClass,
				detectedAt: t.at,
				diagnosis: null,
				diagnosisLoading: !1
			}), this.sendErrorToBackend(n), this.props.onError && this.props.onError(n, { componentStack: null }), this.scheduleAutoRecovery();
		});
	}
	autoTimer = null;
	scheduleAutoRecovery() {
		o.getState().autoRecovery && (this.autoTimer && clearTimeout(this.autoTimer), A({
			type: "info",
			message: "AUTO-RECOVERY armed — restoring checkpoint in 1.2s"
		}), this.autoTimer = setTimeout(() => {
			this.autoTimer = null, this.state.hasError && this.handleRecover();
		}, 1200));
	}
	componentWillUnmount() {
		this.unsubscribeDetector?.(), this.unsubscribeDetector = null, this.autoTimer && clearTimeout(this.autoTimer), this.autoTimer = null;
	}
	async sendErrorToBackend(e, t) {
		try {
			let n = {
				id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				error_type: e.name || "UnknownError",
				error_message: e.message,
				component_stack: t?.componentStack || void 0,
				url: window.location.href,
				user_agent: navigator.userAgent,
				recovery_attempted: !1,
				recovery_successful: !1
			}, r = await fetch("http://localhost:8002/api/errors", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(n)
			});
			if (!r.ok) throw Error(`Backend error: ${r.status}`);
			let i = await r.json();
			await this.fetchDiagnosis(i.id);
		} catch (e) {
			console.error("Failed to send error to backend:", e), A({
				type: "error",
				message: `BACKEND COMMUNICATION FAILED: ${e.message}`
			});
		}
	}
	async fetchDiagnosis(e) {
		this.setState({ diagnosisLoading: !0 });
		for (let t = 0; t < 10; t++) try {
			let t = await fetch(`http://localhost:8002/api/diagnoses/${e}`);
			if (t.status === 404) {
				await new Promise((e) => setTimeout(e, 1e3));
				continue;
			}
			if (!t.ok) throw Error(`Failed to fetch diagnosis: ${t.status}`);
			let n = await t.json();
			this.setState({
				diagnosis: n,
				diagnosisLoading: !1
			}), A({
				type: "success",
				message: `DIAGNOSIS RECEIVED: ${n.root_cause} (confidence: ${(n.confidence * 100).toFixed(1)}%)`
			}), a.getState().addDiagnosis({
				error_id: n.error_id,
				root_cause: n.root_cause,
				confidence: n.confidence,
				suggested_fix: n.suggested_fix,
				prevention_tips: n.prevention_tips,
				llm_model_used: n.llm_model_used
			});
			return;
		} catch (e) {
			console.error("Failed to fetch diagnosis:", e), this.setState({ diagnosisLoading: !1 }), A({
				type: "error",
				message: `DIAGNOSIS FAILED: ${e.message}`
			});
			return;
		}
		this.setState({ diagnosisLoading: !1 }), A({
			type: "error",
			message: "DIAGNOSIS TIMED OUT: no diagnosis received from backend"
		});
	}
	componentDidCatch(e, t) {
		A({
			type: "error",
			message: `ERROR DETECTED: ${e.message}`,
			errorStack: t.componentStack || void 0
		}), this.setState({
			hasError: !0,
			error: e,
			errorInfo: t,
			errorClass: "RENDER_CRASH",
			detectedAt: Date.now()
		}), x({
			errorClass: "RENDER_CRASH",
			message: e.message,
			stack: e.stack,
			source: "boundary"
		}), this.sendErrorToBackend(e, t), this.props.onError && this.props.onError(e, t), console.error("Self-Healing Runtime caught error:", e, t), this.scheduleAutoRecovery();
	}
	handleRecover = () => {
		let e = performance.now(), t = k();
		if (!t) {
			A({
				type: "error",
				message: "No snapshot available for recovery"
			});
			return;
		}
		let n = { form: { ...N() } };
		A({
			type: "recovery",
			message: "RECOVERY EXECUTED - Restoring from checkpoint..."
		}), M();
		let r = { form: { ...N() } }, i = performance.now() - e, a = R({
			errorClass: this.state.errorClass ?? "RENDER_CRASH",
			errorMessage: this.state.error?.message ?? "unknown error",
			preState: n,
			postState: r,
			snapshotId: t.id,
			snapshotTimestamp: t.timestamp,
			detectedAt: this.state.detectedAt ?? Date.now(),
			recoveryDurationMs: i
		});
		B.getState().addCertificate(a);
		let { setIsRecovering: s, incrementRecoveryCount: c } = o.getState();
		s(!0), c(), A({
			type: "success",
			message: `✅ RECOVERED - certificate ${a.id} verified=${a.verified} | state loss ${a.lossWindowMs}ms | restore ${i.toFixed(1)}ms`,
			recoveryTime: i
		}), S(), this.setState({
			hasError: !1,
			error: null,
			errorInfo: null,
			errorClass: null,
			detectedAt: null,
			diagnosis: null,
			diagnosisLoading: !1
		}), setTimeout(() => {
			s(!1);
		}, 500);
	};
	handleReload = () => {
		window.location.reload();
	};
	render() {
		return this.state.hasError ? /* @__PURE__ */ (0, U.jsx)("div", {
			className: "error-recovery-ui min-h-screen bg-slate-100 flex items-center justify-center p-6",
			children: /* @__PURE__ */ (0, U.jsxs)("div", {
				className: "max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-red-200",
				children: [
					/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "flex items-center gap-4 mb-6",
						children: [/* @__PURE__ */ (0, U.jsx)("div", {
							className: "w-12 h-12 bg-red-100 border border-red-200 rounded-xl flex items-center justify-center",
							children: /* @__PURE__ */ (0, U.jsx)("span", {
								className: "text-2xl",
								children: "⚠️"
							})
						}), /* @__PURE__ */ (0, U.jsxs)("div", { children: [
							/* @__PURE__ */ (0, U.jsx)("h1", {
								className: "text-2xl font-bold text-slate-900",
								children: "Runtime Error Detected"
							}),
							/* @__PURE__ */ (0, U.jsx)("p", {
								className: "text-slate-500 text-sm",
								children: "Self-healing runtime is ready to recover"
							}),
							this.state.errorClass && /* @__PURE__ */ (0, U.jsxs)("p", {
								className: "text-xs font-mono text-slate-400 mt-1",
								children: [
									"class: ",
									this.state.errorClass.replace(/_/g, " "),
									" — ",
									_[this.state.errorClass]
								]
							})
						] })]
					}),
					/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "bg-red-50 border border-red-100 p-4 rounded-lg mb-6 font-mono text-sm",
						children: [
							/* @__PURE__ */ (0, U.jsx)("div", {
								className: "text-red-600 font-bold mb-2",
								children: "Error:"
							}),
							/* @__PURE__ */ (0, U.jsx)("div", {
								className: "text-slate-700",
								children: this.state.error?.message
							}),
							this.state.errorInfo?.componentStack && /* @__PURE__ */ (0, U.jsxs)(U.Fragment, { children: [/* @__PURE__ */ (0, U.jsx)("div", {
								className: "text-red-600 font-bold mt-4 mb-2",
								children: "Stack Trace:"
							}), /* @__PURE__ */ (0, U.jsx)("pre", {
								className: "text-slate-500 text-xs overflow-auto max-h-40",
								children: this.state.errorInfo.componentStack
							})] })
						]
					}),
					this.state.diagnosisLoading && /* @__PURE__ */ (0, U.jsx)("div", {
						className: "bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded-r-lg",
						children: /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, U.jsx)("span", {
								className: "text-xl",
								children: "🔄"
							}), /* @__PURE__ */ (0, U.jsx)("span", {
								className: "text-indigo-600 font-medium",
								children: "Getting AI diagnosis..."
							})]
						})
					}),
					!this.state.diagnosisLoading && this.state.diagnosis && /* @__PURE__ */ (0, U.jsxs)("div", {
						className: "bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-4 rounded-r-lg",
						children: [
							/* @__PURE__ */ (0, U.jsxs)("div", {
								className: "flex items-center gap-2 mb-2",
								children: [/* @__PURE__ */ (0, U.jsx)("span", {
									className: "text-xl",
									children: "🤖"
								}), /* @__PURE__ */ (0, U.jsx)("span", {
									className: "text-emerald-700 font-bold",
									children: "AI Diagnosis Complete"
								})]
							}),
							/* @__PURE__ */ (0, U.jsxs)("div", {
								className: "text-emerald-800 text-sm mb-2",
								children: [
									/* @__PURE__ */ (0, U.jsx)("strong", { children: "Root Cause:" }),
									" ",
									this.state.diagnosis.root_cause
								]
							}),
							/* @__PURE__ */ (0, U.jsxs)("div", {
								className: "text-emerald-800 text-sm mb-1",
								children: [
									/* @__PURE__ */ (0, U.jsx)("strong", { children: "Confidence:" }),
									" ",
									(this.state.diagnosis.confidence * 100).toFixed(1),
									"%"
								]
							}),
							/* @__PURE__ */ (0, U.jsxs)("div", {
								className: "text-emerald-800 text-sm mb-1",
								children: [
									/* @__PURE__ */ (0, U.jsx)("strong", { children: "Suggested Fix:" }),
									" ",
									this.state.diagnosis.suggested_fix
								]
							}),
							this.state.diagnosis.prevention_tips.length > 0 && /* @__PURE__ */ (0, U.jsxs)("div", {
								className: "mt-2",
								children: [/* @__PURE__ */ (0, U.jsx)("div", {
									className: "text-emerald-700 font-semibold text-sm mb-1",
									children: "Prevention Tips:"
								}), /* @__PURE__ */ (0, U.jsx)("ul", {
									className: "list-disc list-inside text-emerald-800 text-sm space-y-1",
									children: this.state.diagnosis.prevention_tips.map((e, t) => /* @__PURE__ */ (0, U.jsx)("li", { children: e }, t))
								})]
							})
						]
					}),
					!this.state.diagnosisLoading && !this.state.diagnosis && /* @__PURE__ */ (0, U.jsx)("div", {
						className: "bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg",
						children: /* @__PURE__ */ (0, U.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, U.jsx)("span", {
								className: "text-xl",
								children: "📝"
							}), /* @__PURE__ */ (0, U.jsx)("span", {
								className: "text-amber-700 font-medium",
								children: "Diagnosis pending..."
							})]
						})
					}),
					/* @__PURE__ */ (0, U.jsxs)("div", {
						className: "flex gap-4",
						children: [/* @__PURE__ */ (0, U.jsx)("button", {
							onClick: this.handleRecover,
							className: "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors",
							children: "🔄 Restore from Checkpoint"
						}), /* @__PURE__ */ (0, U.jsx)("button", {
							onClick: this.handleReload,
							className: "flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-lg transition-colors",
							children: "⟳ Full Reload"
						})]
					}),
					/* @__PURE__ */ (0, U.jsx)("div", {
						className: "mt-6 text-xs text-slate-400 text-center",
						children: "Recovery will restore your data from the last known good state and issue a machine-checkable certificate"
					})
				]
			})
		}) : this.props.children;
	}
}, ne = (e) => {
	let t = 0, n = new PerformanceObserver((n) => {
		for (let r of n.getEntries()) {
			let n = r;
			n.hadRecentInput || (t += n.value, e({
				name: "CLS",
				value: t,
				delta: n.value,
				id: n.entryType + "-" + Date.now(),
				entries: [n],
				startTime: n.startTime
			}));
		}
	});
	return n.observe({ entryTypes: ["layout-shift"] }), () => n.disconnect();
}, re = (e) => {
	let t = new PerformanceObserver((t) => {
		for (let n of t.getEntries()) {
			let t = n;
			e({
				name: "FID",
				value: t.processingStart - t.startTime,
				delta: t.processingStart - t.startTime,
				id: t.entryType + "-" + Date.now(),
				entries: [t],
				startTime: t.startTime
			});
		}
	});
	return t.observe({ entryTypes: ["first-input"] }), () => t.disconnect();
}, ie = (e) => {
	let t = new PerformanceObserver((t) => {
		for (let n of t.getEntries()) e({
			name: "LCP",
			value: n.startTime,
			delta: n.startTime,
			id: n.entryType + "-" + Date.now(),
			entries: [n],
			startTime: n.startTime
		});
	});
	return t.observe({ entryTypes: ["largest-contentful-paint"] }), () => t.disconnect();
}, W = {
	LCP: 2500,
	FID: 100,
	CLS: .1,
	TTFB: 800
}, G = {
	LCP: [
		"Optimize and compress images",
		"Use modern image formats (WebP, AVIF)",
		"Implement lazy loading for below-the-fold content",
		"Optimize CSS delivery and reduce render-blocking resources",
		"Use CDN for static assets",
		"Consider server-side rendering or static generation"
	],
	FID: [
		"Minimize JavaScript execution time",
		"Break up long-running JavaScript tasks",
		"Use web workers for background processing",
		"Reduce third-party script impact",
		"Optimize event handlers and callbacks",
		"Consider using requestIdleCallback for low-priority work"
	],
	CLS: [
		"Include size attributes on images and videos",
		"Reserve space for ad elements and embeds",
		"Avoid inserting content above existing content",
		"Use transform animations instead of layout-changing properties",
		"Load web fonts efficiently to prevent FOIT/FOUT",
		"Ensure fallback fonts similar size to web fonts"
	],
	TTFB: [
		"Optimize server response time",
		"Use caching strategies (CDN, browser, server-side)",
		"Optimize database queries and API responses",
		"Reduce redirect chains",
		"Use HTTP/2 or HTTP/3 protocols",
		"Consider edge computing or serverless functions"
	]
}, K = [], q = null, J = () => {
	let e = Y.getState(), t = performance.getEntriesByType("navigation")[0];
	t && e.recordVital("ttfb", {
		name: "TTFB",
		value: t.responseStart,
		delta: t.responseStart,
		id: "nav-" + t.startTime,
		entries: [t],
		startTime: t.startTime
	});
	let n = performance.getEntriesByType("largest-contentful-paint"), r = n[n.length - 1];
	r && e.recordVital("lcp", {
		name: "LCP",
		value: r.startTime,
		delta: r.startTime,
		id: "lcp-" + r.startTime,
		entries: [r],
		startTime: r.startTime
	});
	let i = performance.getEntriesByType("first-input"), a = i[i.length - 1];
	a && e.recordVital("fid", {
		name: "FID",
		value: a.processingStart - a.startTime,
		delta: a.processingStart - a.startTime,
		id: "fid-" + a.startTime,
		entries: [a],
		startTime: a.startTime
	});
	let o = performance.getEntriesByType("layout-shift").filter((e) => !e.hadRecentInput);
	if (o.length > 0) {
		let t = o.reduce((e, t) => e + t.value, 0);
		e.recordVital("cls", {
			name: "CLS",
			value: t,
			delta: o[o.length - 1].value,
			id: "cls-" + Date.now(),
			entries: o,
			startTime: o[o.length - 1].startTime
		});
	}
}, ae = (e) => {
	Y.getState().recordVital("cls", e);
}, oe = (e) => {
	Y.getState().recordVital("fid", e);
}, se = (e) => {
	Y.getState().recordVital("lcp", e);
}, Y = t((e, t) => ({
	lcp: null,
	fid: null,
	cls: null,
	ttfb: null,
	lastUpdated: 0,
	monitoring: !1,
	startMonitoring: () => {
		t().monitoring || (e({ monitoring: !0 }), K.push(ne(ae), re(oe), ie(se)), J(), q = setInterval(J, 1e3));
	},
	stopMonitoring: () => {
		for (e({ monitoring: !1 }); K.length > 0;) K.pop()?.();
		q &&= (clearInterval(q), null);
	},
	recordVital: (n, r) => {
		e(() => ({
			[n]: r,
			lastUpdated: Date.now()
		})), t().checkAndTriggerPreventiveActions();
	},
	checkAndTriggerPreventiveActions: () => {
		let { lcp: e, fid: n, cls: r, ttfb: i } = t(), s = a.getState(), c = o.getState(), l = [], u = [];
		if (e && e.value > W.LCP && (l.push(`LCP too high: ${e.value.toFixed(0)}ms (threshold: ${W.LCP}ms)`), u.push(...G.LCP)), n && n.value > W.FID && (l.push(`FID too high: ${n.value.toFixed(0)}ms (threshold: ${W.FID}ms)`), u.push(...G.FID)), r && r.value > W.CLS && (l.push(`CLS too high: ${r.value.toFixed(3)} (threshold: ${W.CLS})`), u.push(...G.CLS)), i && i.value > W.TTFB && (l.push(`TTFB too high: ${i.value.toFixed(0)}ms (threshold: ${W.TTFB}ms)`), u.push(...G.TTFB)), l.length > 0) {
			let e = {
				error_id: `web-vitals-${Date.now()}`,
				root_cause: `Web Vitals performance issues detected: ${l.join("; ")}`,
				confidence: .8,
				suggested_fix: "Address the specific web vitals issues listed in preventive actions",
				prevention_tips: [...new Set(u)],
				llm_model_used: "web-vitals-monitor"
			};
			s.addDiagnosis(e), c.setIsRecovering(!0), setTimeout(() => {
				c.setIsRecovering(!1);
			}, 2e3);
		}
	},
	reset: () => {
		e({
			lcp: null,
			fid: null,
			cls: null,
			ttfb: null,
			lastUpdated: 0,
			monitoring: !1
		});
	}
})), ce = "self-healing-sync", le = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, X = null, Z = null, Q = null, $ = null, ue = t((e, t) => ({
	currentTabId: le(),
	otherTabs: {},
	channel: null,
	syncSupported: null,
	isSyncing: !1,
	lastSyncAt: null,
	initializeSync: () => {
		if (t().channel) return;
		if (typeof BroadcastChannel > "u") {
			e({ syncSupported: !1 }), console.warn("BroadcastChannel not supported in this browser");
			return;
		}
		let n = new BroadcastChannel(ce), { currentTabId: r } = t();
		n.onmessage = (n) => {
			let { type: i, tabId: a, state: o, timestamp: s } = n.data;
			if (a !== r) switch (i) {
				case "HEARTBEAT":
					e((e) => ({
						otherTabs: {
							...e.otherTabs,
							[a]: {
								tabId: a,
								lastHeartbeat: s,
								state: o,
								status: "active"
							}
						},
						isSyncing: !1,
						lastSyncAt: s
					})), Q !== null && (clearTimeout(Q), Q = null);
					break;
				case "REQUEST_STATE":
					t().sendHeartbeat();
					break;
				case "TAB_CLOSING": e((e) => {
					let { [a]: t, ...n } = e.otherTabs;
					return { otherTabs: n };
				});
			}
		}, e({
			channel: n,
			syncSupported: !0
		}), n.postMessage({
			type: "REQUEST_STATE",
			tabId: r,
			timestamp: Date.now()
		}), X = setInterval(() => {
			t().sendHeartbeat();
		}, 2e3), Z = setInterval(() => {
			t().detectDeadTabs();
		}, 5e3), $ = () => t().cleanup(), window.addEventListener("beforeunload", $);
	},
	sendHeartbeat: () => {
		let { channel: e, currentTabId: n } = t();
		if (!e) return;
		let r = D.getState(), i = {
			form: r.form,
			snapshots: r.snapshots,
			recoveryCount: r.snapshots.length
		};
		e.postMessage({
			type: "HEARTBEAT",
			tabId: n,
			state: i,
			timestamp: Date.now()
		});
	},
	requestSync: () => {
		let { channel: n } = t();
		n && (e({ isSyncing: !0 }), n.postMessage({
			type: "REQUEST_STATE",
			tabId: t().currentTabId,
			timestamp: Date.now()
		}), Q !== null && clearTimeout(Q), Q = setTimeout(() => {
			e({ isSyncing: !1 }), Q = null;
		}, 1200));
	},
	detectDeadTabs: () => {
		let n = Date.now(), { otherTabs: r } = t(), i = { ...r }, a = [], o = !1;
		Object.entries(r).forEach(([e, t]) => {
			let r = n - t.lastHeartbeat, s = r >= 2e4 ? "crashed" : r >= 6e3 ? "idle" : "active";
			s !== t.status && (o = !0, i[e] = {
				...t,
				status: s
			}, s === "crashed" && a.push(e));
		}), o && e({ otherTabs: i }), a.forEach((e) => {
			D.getState().addLog({
				type: "error",
				message: `Tab ${e.slice(-6)} stopped responding (no heartbeat for 20s)`
			}), t().recoverFromTab(e);
		});
	},
	recoverFromTab: (e) => {
		let { otherTabs: n } = t(), r = n[e];
		if (!r) {
			D.getState().addLog({
				type: "error",
				message: `Cannot restore: browser tab ${e.slice(-6)} is no longer available`
			});
			return;
		}
		let i = r.state?.form;
		if (!i || typeof i != "object" || Array.isArray(i)) {
			D.getState().addLog({
				type: "error",
				message: `Cannot restore: browser tab ${e.slice(-6)} has no saved form state`
			});
			return;
		}
		let a = D.getState(), o = { form: { ...a.form } };
		a.updateForm(i), a.addLog({
			type: "recovery",
			message: `Restoring the latest synced form state from tab ${e.slice(-6)}`
		}), a.takeSnapshot(i), a.addLog({
			type: "success",
			message: `Form state restored from tab ${e.slice(-6)}`
		});
		let s = Array.isArray(r.state?.snapshots) ? r.state.snapshots : [], c = s[s.length - 1], l = { form: { ...D.getState().form } }, u = R({
			errorClass: "MULTI_TAB",
			errorMessage: `Tab ${e.slice(-6)} became unresponsive`,
			preState: o,
			postState: l,
			snapshotId: c?.id ?? "tab-sync",
			snapshotTimestamp: c?.timestamp ?? r.lastHeartbeat,
			detectedAt: Date.now(),
			recoveryDurationMs: 0
		});
		B.getState().addCertificate(u), D.getState().addLog({
			type: "success",
			message: `Multi-tab recovery certificate ${u.id} verified=${u.verified}`
		});
	},
	cleanup: () => {
		let { channel: n, currentTabId: r } = t();
		X !== null && (clearInterval(X), X = null), Z !== null && (clearInterval(Z), Z = null), Q !== null && (clearTimeout(Q), Q = null), $ &&= (window.removeEventListener("beforeunload", $), null), n && (n.onmessage = null, e({ channel: null }), n.postMessage({
			type: "TAB_CLOSING",
			tabId: r,
			timestamp: Date.now()
		}), n.close()), e({ isSyncing: !1 });
	}
}));
//#endregion
export { f as CHAIN_INVARIANTS, g as ERROR_CLASSES, _ as ERROR_CLASS_DESCRIPTIONS, c as FORM_SCHEMA_KEYS, d as STATE_INVARIANTS, te as SelfHealingBoundary, W as VITALS_THRESHOLDS, A as addRecoveryLog, m as allInvariantsPass, F as canonicalJson, p as checkInvariants, C as classifyRawError, S as clearActiveError, P as djb2, V as exportCertificates, h as firstViolation, N as getForm, k as getLatestSnapshot, I as hashState, T as initErrorDetector, R as issueCertificate, x as reportError, M as restoreFromSnapshot, j as setSubmitting, O as takeSnapshot, B as useCertificateStore, b as useDetectorStore, a as useDiagnosisStore, ue as useMultiTabStore, o as useRecoveryStore, D as useSnapshotStore, Y as useWebVitalsStore, z as verifyCertificate };

//# sourceMappingURL=index.es.js.map