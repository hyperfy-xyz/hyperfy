# Utils

This document covers miscellaneous utility globals available in the scripting environment.

---

## `num`

A global method for generating random numbers. This is provided as a substitute for `Math.random()`, which is not available in the app script runtime.

```javascript
/**
 * function num(min, max, dp=0) 
 */ 

// get a random integer between 0 and 10
const randomInt = num(0, 10);

// get a random float between 100 and 1000 with 2 decimal places
const randomFloat = num(100, 1000, 2);
```

---

## Three.js

Certain `three.js` classes and methods are exposed directly in the scripting API for your convenience.

- [`Vector3`](https://threejs.org/docs/#api/en/math/Vector3)
- [`Quaternion`](https://threejs.org/docs/#api/en/math/Quaternion)
- [`Euler`](https://threejs.org/docs/#api/en/math/Euler)
- [`Matrix4`](https://threejs.org/docs/#api/en/math/Matrix4)

---

## Fetch

The standard `fetch` API is available for making network requests.

- [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)