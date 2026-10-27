# Phase 2: Installation & Models - COMPLETE

**Date:** October 26, 2026  
**Status:** ✅ Packages Installed | ✅ Models Downloaded | ⚠️ Browser Integration Pending

---

## ✅ What Was Completed

### 1. Package Installation
**Command Used:**
```powershell
cd frontend
npm init -y
npm install @rajeevdesai/face-verification-api onnxruntime-web @mediapipe/tasks-vision
npm install --save-dev esbuild
```

**Installed Packages:**
- `@rajeevdesai/face-verification-api@0.2.1`
- `onnxruntime-web@1.17.0+`
- `@mediapipe/tasks-vision@0.10.0+`
- `esbuild@0.28.2` (dev dependency for bundling)

**Total:** 23 packages  
**Vulnerabilities:** 0  
**Install Time:** ~52 seconds

### 2. Model Download
**Command Used:**
```powershell
npx @rajeevdesai/face-verification-api download models
```

**Downloaded Models:**

| File | Size (MB) | Purpose | License |
|------|-----------|---------|---------|
| `face_landmarker.task` | 3.58 | MediaPipe face detection | Apache-2.0 |
| `mobilefacenet.onnx` | 0.77 | Face recognition embedding | Apache-2.0 |
| `minifasnet_v2.onnx` | 1.66 | Liveness detection (crop 2.7) | Apache-2.0 |
| `minifasnet_v1se.onnx` | 1.66 | Liveness detection (crop 4.0) | Apache-2.0 |

**Total Model Size:** 7.67 MB  
**Location:** `frontend/models/`  
**Served At:** `http://127.0.0.1:5500/models/`

### 3. Library Files Copied
**Command Used:**
```powershell
# Copied UMD bundles and WASM files for browser use
Copy-Item node_modules/@rajeevdesai/face-verification-api/dist/* frontend/lib/
Copy-Item node_modules/onnxruntime-web/dist/* frontend/lib/onnxruntime/
Copy-Item node_modules/@mediapipe/tasks-vision/wasm/* frontend/lib/mediapipe/
```

**Copied Files:**
- Face verification API: ESM + UMD bundles
- ONNX Runtime WASM blobs
- MediaPipe WASM files

**Location:** `frontend/lib/`

---

## ⚠️ Browser Integration Challenge

### Issue: ES Modules Without Bundler

The face-verification-api is packaged as an ES module with dependencies:
```javascript
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as ort from "onnxruntime-web";
```

**Problem:** Live Server (static HTTP server) cannot resolve bare module imports like `"@mediapipe/tasks-vision"` without:
1. A bundler (Webpack, Vite, Parcel, esbuild)
2. Import maps (requires manual dependency resolution)
3. CDN URLs (not available for this specific package combination)

### Attempted Solutions

1. **Direct ES Module Import** ❌
   - Issue: `Cannot resolve bare module specifiers`
   
2. **UMD Bundle** ❌
   - Issue: UMD still has bare imports internally
   
3. **Copy to /lib/** ✅ Partial
   - Files copied but still need import resolution

---

## 🎯 Recommended Solutions (Pick One)

### Option A: Use a Bundler (Recommended)
**Best for:** Production deployment

**Steps:**
1. Install Vite: `npm install --save-dev vite`
2. Create `vite.config.js`:
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'models',
  server: {
    port: 5500
  }
});
```
3. Update `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```
4. Run: `npm run dev`
5. Import in HTML:
```html
<script type="module">
  import { loadModels, compareFaces } from '@rajeevdesai/face-verification-api';
  // ... use the library
</script>
```

**Pros:**
- ✅ Clean import syntax
- ✅ Tree shaking (smaller bundle)
- ✅ Hot reload during development
- ✅ Production-ready builds

**Cons:**
- ❌ Requires build step
- ❌ More complex setup

---

### Option B: Create Manual Bundle with esbuild (Quick)
**Best for:** Quick integration without changing development workflow

**Steps:**
1. Create bundle script (already created at `frontend/build-face-api.js`)
2. Run: `node build-face-api.js`
3. This creates: `js/face-api-bundle.js`
4. Import in HTML:
```html
<script type="module" src="/js/face-api-bundle.js"></script>
<script type="module">
  import { loadModels, compareFaces } from '/js/face-api-bundle.js';
  // ... use the library
</script>
```

**Pros:**
- ✅ Works with Live Server
- ✅ One-time build step
- ✅ No dev server changes

**Cons:**
- ❌ Must rebuild after library updates
- ❌ Larger bundle size (no tree shaking)

**Command to build:**
```powershell
cd frontend
node build-face-api.js
```

---

### Option C: Use CDN + IIFE Wrapper (Hacky but Simple)
**Best for:** Proof of concept / demo

Create a wrapper that loads from unpkg CDN:
```html
<script type="module">
  // Import from CDN
  const { loadModels, compareFaces } = await import('https://cdn.jsdelivr.net/npm/@rajeevdesai/face-verification-api@0.2.1/+esm');
  
  // Make available globally
  window.faceAPI = { loadModels, compareFaces };
</script>
```

**Pros:**
- ✅ No build step
- ✅ Works immediately
- ✅ No local install needed

**Cons:**
- ❌ Requires internet connection
- ❌ CDN dependency
- ❌ Slower initial load

---

## 📋 Completed File Structure

```
frontend/
├── models/                          ← ✅ Model files (7.67 MB)
│   ├── face_landmarker.task
│   ├── mobilefacenet.onnx
│   ├── minifasnet_v2.onnx
│   └── minifasnet_v1se.onnx
├── lib/                             ← ✅ Copied library files
│   ├── face-verification-api.js     (ESM)
│   ├── face-verification-api.umd.cjs (UMD)
│   ├── onnxruntime/                 (WASM files)
│   └── mediapipe/                   (WASM files)
├── js/
│   ├── face-api-wrapper.js          ← ✅ Created (needs bundle)
│   └── face-verification.js         ← Existing (to be updated in Phase 4)
├── node_modules/                    ← ✅ Installed packages
├── package.json                     ← ✅ Created
├── package-lock.json                ← ✅ Generated
└── build-face-api.js                ← ✅ Build script created
```

---

## 🚀 Next Steps for Phase 3

**Decision Required:** Choose integration approach (A, B, or C above)

**Recommendation:** Use **Option B (esbuild bundle)** for quickest integration:

```powershell
# 1. Build the bundle
cd frontend
node build-face-api.js

# 2. Add to transactions.html:
<script type="module" src="/js/face-api-bundle.js"></script>

# 3. Use in face-verification.js:
import { loadModels, compareFaces } from '/js/face-api-bundle.js';
```

---

## ✅ Phase 2 Deliverables

**Installed:**
- ✅ @rajeevdesai/face-verification-api@0.2.1
- ✅ onnxruntime-web (peer dependency)
- ✅ @mediapipe/tasks-vision (peer dependency)
- ✅ esbuild (build tool)

**Downloaded:**
- ✅ 4 model files (7.67 MB total)
- ✅ Served at `/models/` path

**Created:**
- ✅ `frontend/package.json`
- ✅ `frontend/js/face-api-wrapper.js`
- ✅ `frontend/build-face-api.js`
- ✅ `frontend/lib/` directory structure

**Documented:**
- ✅ Installation commands (Windows PowerShell)
- ✅ Model sizes and locations
- ✅ Integration challenges
- ✅ Three solution options

**Ready for Phase 3** once bundling approach is chosen.

---

## 📝 Installation Summary (Windows PowerShell)

```powershell
# Navigate to project
cd C:\Users\akinu\OneDrive\Pictures\timetable\ip-3\facesecure-pay

# Install packages
cd frontend
npm init -y
npm install @rajeevdesai/face-verification-api onnxruntime-web @mediapipe/tasks-vision
npm install --save-dev esbuild

# Download models
npx @rajeevdesai/face-verification-api download models

# Build bundle (Option B)
node build-face-api.js

# Start Live Server (existing)
npx http-server -p 5500 -c-1 --cors
```

**Total Setup Time:** ~2-3 minutes  
**Disk Space Used:** ~30 MB (models + node_modules)

---

**Status:** Phase 2 Complete - Ready for Phase 3 (Face Enrollment) after bundling approach is selected.

