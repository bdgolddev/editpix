/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULTS = {
    brightness: 20,
    exposure: 30,
    contrast: 12,
    highlight: 35,
    shadow: 20,
    vignette: 20,
    saturation: 40,
    warmth: 0,
    tint: 0,
    sharpness: 50,
    rotation: 0,
    flipH: false,
    flipV: false,
    crop: null
};

const SLIDERS = [
    ["brightness", "Brightness", -100, 100],
    ["exposure", "Exposure", -100, 100],
    ["contrast", "Contrast", -100, 100],
    ["highlight", "Highlight", -100, 100],
    ["shadow", "Shadow", -100, 100],
    ["vignette", "Vignette", -100, 100],
    ["saturation", "Saturation", -100, 100],
    ["warmth", "Warmth", -100, 100],
    ["tint", "Tint", -100, 100],
    ["sharpness", "Sharpness", 0, 100]
];

let photos = [];
let current = -1;
let settings = structuredClone(DEFAULTS);
let copied = structuredClone(DEFAULTS);
let busy = false;
let cropRatio = "1.333333";



/* =========================================================
   ELEMENTS
========================================================= */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const cropStage = document.getElementById("cropStage");
const cropImage = document.getElementById("cropImage");
const cropBox = document.getElementById("cropBox");
const zoomLabel = document.getElementById("zoomLabel");
const status = document.getElementById("status");


/* =========================================================
   YEAR
========================================================= */

document.getElementById("year").textContent =
    new Date().getFullYear();


/* =========================================================
   SLIDERS
========================================================= */

const slidersBox = document.getElementById("sliders");

SLIDERS.forEach(([key, label, min, max]) => {

    const el = document.createElement("div");

    el.className = "control";

    el.innerHTML = `
    <div class="control-head">
      <span class="control-name">${label}</span>
      <span class="control-value" id="${key}Value">
        ${fmt(DEFAULTS[key])}
      </span>
    </div>

    <input class="range"
           id="${key}"
           type="range"
           min="${min}"
           max="${max}"
           value="${DEFAULTS[key]}">
  `;

    slidersBox.appendChild(el);

    document.getElementById(key)
        .addEventListener("input", e => {

            settings[key] = Number(e.target.value);

            updateValue(key);
            saveSettings();
            render();

        });

});


function fmt(v) {
    return Number(v) > 0 ? "+" + v : String(v);
}


function updateValue(key) {

    document.getElementById(key + "Value")
        .textContent = fmt(settings[key]);

}


/* =========================================================
   UPLOAD
========================================================= */

document.getElementById("fileInput")
    .addEventListener("change", async e => {

        await loadFiles(
            [...e.target.files].map(file => ({ file }))
        );

        e.target.value = "";

    });


document.getElementById("uploadLabel")
    .addEventListener("click", async e => {

        if (!window.showOpenFilePicker)
            return;

        e.preventDefault();

        try {

            const handles = await showOpenFilePicker({

                multiple: true,

                id: "EditPix-Edit-Folder",

                types: [{
                    description: "Images",
                    accept: {
                        "image/*": [
                            ".jpg",
                            ".jpeg",
                            ".png",
                            ".webp"
                        ]
                    }
                }]

            });

            const list = [];

            for (const handle of handles) {

                const file = await handle.getFile();

                list.push({
                    file,
                    handle
                });

            }

            await loadFiles(list);

        } catch (e) {

            if (e.name !== "AbortError")
                setStatus("Unable to open files");

        }

    });


async function loadFiles(list) {

    if (!list.length)
        return;

    setStatus("Loading photos...");

    for (const item of list) {

        const file = item.file;

        if (!file.type.startsWith("image/"))
            continue;

        const url = URL.createObjectURL(file);

        const image = new Image();

        image.src = url;

        await waitImage(image);

        if (!image.naturalWidth || !image.naturalHeight) {

            URL.revokeObjectURL(url);
            continue;

        }

        photos.push({

            file,
            handle: item.handle || null,

            name: file.name,
            type: file.type,

            url,
            image,

            settings: structuredClone(DEFAULTS),

            replaceError: false,
            errorMessage: ""

        });

    }

    if (current < 0 && photos.length) {

        current = 0;
        loadCurrent();

    }

    renderThumbs();
    counter();

    setStatus(`${photos.length} photos ready`);

}


/* =========================================================
   THUMBNAILS
========================================================= */

function renderThumbs() {

    const box = document.getElementById("thumbs");

    box.innerHTML = "";

    if (!photos.length) {

        box.innerHTML =
            `<div class="empty-list">
        Upload photos to begin
      </div>`;

        return;

    }

    photos.forEach((p, i) => {

        const el = document.createElement("div");

        el.className =
            "thumb" +
            (i === current ? " active" : "") +
            (p.replaceError ? " failed" : "");

        let meta = "Ready";

        if (i === current)
            meta = "Editing";

        if (p.replaceError)
            meta = p.errorMessage
                ? "Replace failed"
                : "Replace failed";

        el.innerHTML = `

      <img src="${p.url}">

      <div class="thumb-info">

        <div class="thumb-name">
          ${esc(p.name)}
        </div>

        <div class="thumb-meta
          ${p.replaceError ? "thumb-failed" : ""}">
          ${meta}
        </div>

      </div>
    `;

        el.onclick = () => {

            if (busy)
                return;

            current = i;

            loadCurrent();
            renderThumbs();

        };

        box.appendChild(el);

    });

}


/* =========================================================
   CURRENT
========================================================= */

function loadCurrent() {

    if (current < 0 || current >= photos.length)
        return;

    settings =
        structuredClone(
            photos[current].settings
        );

    SLIDERS.forEach(([key]) => {

        document.getElementById(key).value =
            settings[key];

        updateValue(key);

    });

    syncRotation();

    document.getElementById("emptyState")
        .style.display = "none";

    document.getElementById("saveBtn")
        .disabled = false;

    document.getElementById("saveAllBtn")
        .disabled = false;

    render();

}


function saveSettings() {

    if (current >= 0 && current < photos.length) {

        photos[current].settings =
            structuredClone(settings);

    }

}


/* =========================================================
   ROTATION
========================================================= */

document.getElementById("rotateLeft").onclick = () => {

    settings.rotation -= 90;

    normalizeRotation();
    syncRotation();
    saveSettings();
    render();

};


document.getElementById("rotateRight").onclick = () => {

    settings.rotation += 90;

    normalizeRotation();
    syncRotation();
    saveSettings();
    render();

};


document.getElementById("applyDegree").onclick = () => {

    const n = Number(
        document.getElementById("degreeInput").value
    );

    if (!Number.isFinite(n))
        return;

    settings.rotation = n;

    normalizeRotation();
    syncRotation();
    saveSettings();
    render();

};


document.getElementById("degreeRange").oninput = e => {

    settings.rotation = Number(e.target.value);

    syncRotation();
    saveSettings();
    render();

};


function normalizeRotation() {

    while (settings.rotation > 360)
        settings.rotation -= 360;

    while (settings.rotation < -360)
        settings.rotation += 360;

}


function syncRotation() {

    document.getElementById("degreeInput").value =
        Number(settings.rotation.toFixed(2));

    document.getElementById("degreeRange").value =
        clamp(settings.rotation, -180, 180);

}


document.getElementById("flipH").onclick = () => {

    settings.flipH = !settings.flipH;

    saveSettings();
    render();

};


document.getElementById("flipV").onclick = () => {

    settings.flipV = !settings.flipV;

    saveSettings();
    render();

};


/* =========================================================
   CROP
========================================================= */

document.querySelectorAll(".ratio").forEach(btn => {

    btn.onclick = () => {

        document.querySelectorAll(".ratio")
            .forEach(x => x.classList.remove("active"));

        btn.classList.add("active");

        cropRatio = btn.dataset.ratio;

    };

});


let cropState = {

    zoom: 1,
    baseScale: 1,

    panX: 0,
    panY: 0,

    x: 0,
    y: 0,
    w: 0,
    h: 0,

    dragging: false,
    draggingBox: false,
    resizing: false,

    handle: null,

    sx: 0,
    sy: 0,

    startX: 0,
    startY: 0,

    startW: 0,
    startH: 0

};


document.getElementById("startCrop").onclick = openCrop;


function openCrop() {

    if (current < 0)
        return;

    cropStage.style.display = "block";
    canvas.style.visibility = "hidden";

    const p = photos[current];

    cropImage.src = p.url;

    cropState.zoom = 1;
    cropState.panX = 0;
    cropState.panY = 0;

    setTimeout(() => {

        fitCropImage();
        createCropBox();

        if (p.settings.crop)
            restoreCropFromSettings(p.settings.crop);

        constrainImage();
        updateCrop();

    }, 30);

    setStatus(
        "Crop mode • Mouse wheel to zoom • Drag to move"
    );

}


function fitCropImage() {

    const sw = cropStage.clientWidth;
    const sh = cropStage.clientHeight;

    const iw = cropImage.naturalWidth;
    const ih = cropImage.naturalHeight;

    const fit =
        Math.min(sw / iw, sh / ih) * .88;

    cropState.baseScale = fit;
    cropState.zoom = 1;

    cropState.panX = 0;
    cropState.panY = 0;

    cropImage.style.width = iw * fit + "px";
    cropImage.style.height = ih * fit + "px";

    cropImage.style.transform =
        "translate(-50%,-50%)";

    zoomLabel.textContent = "100%";

}


function createCropBox() {

    const sw = cropStage.clientWidth;
    const sh = cropStage.clientHeight;

    const margin = Math.min(sw, sh) * .18;

    let w = sw - margin * 2;
    let h = sh - margin * 2;

    if (cropRatio !== "free") {

        const r = Number(cropRatio);

        if (w / h > r)
            w = h * r;
        else
            h = w / r;

    }

    cropState.x = (sw - w) / 2;
    cropState.y = (sh - h) / 2;

    cropState.w = w;
    cropState.h = h;

}


function restoreCropFromSettings(crop) {

    if (!crop)
        return;

    const sw = cropStage.clientWidth;
    const sh = cropStage.clientHeight;

    const imageW =
        cropImage.naturalWidth *
        cropState.baseScale;

    const imageH =
        cropImage.naturalHeight *
        cropState.baseScale;

    cropState.x =
        (sw - imageW) / 2 +
        crop.x * imageW;

    cropState.y =
        (sh - imageH) / 2 +
        crop.y * imageH;

    cropState.w = crop.width * imageW;
    cropState.h = crop.height * imageH;

    cropState.x = clamp(
        cropState.x,
        0,
        sw - cropState.w
    );

    cropState.y = clamp(
        cropState.y,
        0,
        sh - cropState.h
    );

}


function updateCrop() {

    cropBox.style.left = cropState.x + "px";
    cropBox.style.top = cropState.y + "px";

    cropBox.style.width = cropState.w + "px";
    cropBox.style.height = cropState.h + "px";

    const scale =
        cropState.baseScale *
        cropState.zoom;

    cropImage.style.width =
        cropImage.naturalWidth * scale + "px";

    cropImage.style.height =
        cropImage.naturalHeight * scale + "px";

    cropImage.style.transform =
        `translate(
      calc(-50% + ${cropState.panX}px),
      calc(-50% + ${cropState.panY}px)
    )`;

    zoomLabel.textContent =
        Math.round(cropState.zoom * 100) + "%";

}


cropStage.addEventListener(
    "wheel",
    e => {

        if (cropStage.style.display === "none")
            return;

        e.preventDefault();

        const rect = cropStage.getBoundingClientRect();

        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const old = cropState.zoom;

        const factor = e.deltaY < 0 ? 1.12 : .89;

        const next = clamp(old * factor, .25, 5);

        const ratio = next / old;

        const cx =
            cropStage.clientWidth / 2 +
            cropState.panX;

        const cy =
            cropStage.clientHeight / 2 +
            cropState.panY;

        cropState.panX =
            mx - (mx - cx) * ratio -
            cropStage.clientWidth / 2;

        cropState.panY =
            my - (my - cy) * ratio -
            cropStage.clientHeight / 2;

        cropState.zoom = next;

        constrainImage();
        updateCrop();
        saveCropState();

    },
    { passive: false }
);


document.getElementById("zoomIn").onclick = () => {
    zoomButton(1.15);
};


document.getElementById("zoomOut").onclick = () => {
    zoomButton(.87);
};


function zoomButton(f) {

    cropState.zoom =
        clamp(cropState.zoom * f, .25, 5);

    cropState.panX *= f;
    cropState.panY *= f;

    constrainImage();
    updateCrop();
    saveCropState();

}


document.getElementById("fitCrop").onclick = () => {

    fitCropImage();
    updateCrop();
    saveCropState();

};


cropStage.addEventListener(
    "pointerdown",
    e => {

        if (
            e.target.classList.contains("handle") ||
            e.target === cropBox ||
            cropBox.contains(e.target)
        )
            return;

        cropState.dragging = true;

        cropState.sx = e.clientX;
        cropState.sy = e.clientY;

        cropState.startX = cropState.panX;
        cropState.startY = cropState.panY;

        cropStage.setPointerCapture(e.pointerId);

    }
);


cropStage.addEventListener(
    "pointermove",
    e => {

        if (!cropState.dragging)
            return;

        cropState.panX =
            cropState.startX +
            e.clientX -
            cropState.sx;

        cropState.panY =
            cropState.startY +
            e.clientY -
            cropState.sy;

        constrainImage();
        updateCrop();
        saveCropState();

    }
);


cropStage.addEventListener(
    "pointerup",
    () => {
        cropState.dragging = false;
    }
);


cropBox.addEventListener(
    "pointerdown",
    e => {

        if (e.target.classList.contains("handle"))
            return;

        e.stopPropagation();

        cropState.draggingBox = true;

        cropState.sx = e.clientX;
        cropState.sy = e.clientY;

        cropState.startX = cropState.x;
        cropState.startY = cropState.y;

        cropBox.setPointerCapture(e.pointerId);

    }
);


cropBox.addEventListener(
    "pointermove",
    e => {

        if (!cropState.draggingBox)
            return;

        cropState.x =
            cropState.startX +
            e.clientX -
            cropState.sx;

        cropState.y =
            cropState.startY +
            e.clientY -
            cropState.sy;

        constrainBox();
        updateCrop();
        saveCropState();

    }
);


cropBox.addEventListener(
    "pointerup",
    () => {
        cropState.draggingBox = false;
    }
);


document.querySelectorAll(".handle")
    .forEach(handle => {

        handle.addEventListener(
            "pointerdown",
            e => {

                e.stopPropagation();

                cropState.resizing = true;
                cropState.handle = handle.dataset.h;

                cropState.sx = e.clientX;
                cropState.sy = e.clientY;

                cropState.startX = cropState.x;
                cropState.startY = cropState.y;

                cropState.startW = cropState.w;
                cropState.startH = cropState.h;

                handle.setPointerCapture(e.pointerId);

            }
        );


        handle.addEventListener(
            "pointermove",
            e => {

                if (!cropState.resizing)
                    return;

                resizeCrop(
                    e.clientX - cropState.sx,
                    e.clientY - cropState.sy
                );

                updateCrop();
                saveCropState();

            }
        );


        handle.addEventListener(
            "pointerup",
            () => {
                cropState.resizing = false;
            }
        );

    });


function resizeCrop(dx, dy) {

    let x = cropState.startX;
    let y = cropState.startY;

    let w = cropState.startW;
    let h = cropState.startH;

    const handle = cropState.handle;
    const min = 35;

    if (handle.includes("e"))
        w = Math.max(min, cropState.startW + dx);

    if (handle.includes("s"))
        h = Math.max(min, cropState.startH + dy);

    if (handle.includes("w")) {

        const nx = Math.min(
            cropState.startX +
            cropState.startW -
            min,

            cropState.startX + dx
        );

        x = nx;

        w =
            cropState.startW +
            cropState.startX -
            nx;

    }

    if (handle.includes("n")) {

        const ny = Math.min(
            cropState.startY +
            cropState.startH -
            min,

            cropState.startY + dy
        );

        y = ny;

        h =
            cropState.startH +
            cropState.startY -
            ny;

    }

    if (cropRatio !== "free") {

        const ratio = Number(cropRatio);

        if (
            handle.includes("e") ||
            handle.includes("w")
        )
            h = w / ratio;
        else
            w = h * ratio;

        if (handle.includes("n"))
            y =
                cropState.startY +
                cropState.startH -
                h;

        if (handle.includes("w"))
            x =
                cropState.startX +
                cropState.startW -
                w;

    }

    cropState.x = x;
    cropState.y = y;
    cropState.w = w;
    cropState.h = h;

    constrainBox();

}


function constrainBox() {

    const sw = cropStage.clientWidth;
    const sh = cropStage.clientHeight;

    cropState.w = clamp(cropState.w, 35, sw);
    cropState.h = clamp(cropState.h, 35, sh);

    cropState.x = clamp(
        cropState.x,
        0,
        Math.max(0, sw - cropState.w)
    );

    cropState.y = clamp(
        cropState.y,
        0,
        Math.max(0, sh - cropState.h)
    );

}


function constrainImage() {

    const scale =
        cropState.baseScale *
        cropState.zoom;

    const iw = cropImage.naturalWidth * scale;
    const ih = cropImage.naturalHeight * scale;

    const sw = cropStage.clientWidth;
    const sh = cropStage.clientHeight;

    let cx = sw / 2 + cropState.panX;
    let cy = sh / 2 + cropState.panY;

    const boxL = cropState.x;
    const boxR = cropState.x + cropState.w;
    const boxT = cropState.y;
    const boxB = cropState.y + cropState.h;

    let left = cx - iw / 2;
    let right = cx + iw / 2;
    let top = cy - ih / 2;
    let bottom = cy + ih / 2;

    if (iw >= cropState.w) {

        if (left > boxL)
            cx -= left - boxL;

        if (right < boxR)
            cx += boxR - right;

    }

    if (ih >= cropState.h) {

        if (top > boxT)
            cy -= top - boxT;

        if (bottom < boxB)
            cy += boxB - bottom;

    }

    cropState.panX = cx - sw / 2;
    cropState.panY = cy - sh / 2;

}


function saveCropState() {

    if (current < 0 || !photos[current])
        return;

    const p = photos[current];

    const scale =
        cropState.baseScale *
        cropState.zoom;

    const imageCX =
        cropStage.clientWidth / 2 +
        cropState.panX;

    const imageCY =
        cropStage.clientHeight / 2 +
        cropState.panY;

    const imageW =
        cropImage.naturalWidth * scale;

    const imageH =
        cropImage.naturalHeight * scale;

    const imageLeft = imageCX - imageW / 2;
    const imageTop = imageCY - imageH / 2;

    let sx =
        (cropState.x - imageLeft) / scale;

    let sy =
        (cropState.y - imageTop) / scale;

    let sw = cropState.w / scale;
    let sh = cropState.h / scale;

    sx = clamp(sx, 0, p.image.naturalWidth);
    sy = clamp(sy, 0, p.image.naturalHeight);

    sw = Math.min(
        sw,
        p.image.naturalWidth - sx
    );

    sh = Math.min(
        sh,
        p.image.naturalHeight - sy
    );

    if (sw <= 0 || sh <= 0)
        return;

    p.settings.crop = {

        x: sx / p.image.naturalWidth,
        y: sy / p.image.naturalHeight,

        width: sw / p.image.naturalWidth,
        height: sh / p.image.naturalHeight

    };

    settings.crop =
        structuredClone(p.settings.crop);

}


document.getElementById("cancelCrop")
    .onclick = closeCrop;


function closeCrop() {

    if (
        cropStage.style.display !== "none" &&
        current >= 0
    )
        saveCropState();

    cropStage.style.display = "none";
    canvas.style.visibility = "visible";

    cropState.dragging = false;
    cropState.draggingBox = false;
    cropState.resizing = false;

    render();

}


/* =========================================================
   RENDER
========================================================= */

function render() {

    if (current < 0 || current >= photos.length)
        return;

    const p = photos[current];
    const img = p.image;

    const max = 1500;

    const scale =
        Math.min(
            1,
            max / Math.max(
                img.naturalWidth,
                img.naturalHeight
            )
        );

    const w = Math.max(
        1,
        Math.round(img.naturalWidth * scale)
    );

    const h = Math.max(
        1,
        Math.round(img.naturalHeight * scale)
    );

    let out = renderTransform(
        img,
        settings,
        w,
        h
    );

    if (settings.crop)
        out = cropNormalized(
            out,
            settings.crop
        );

    canvas.width = out.width;
    canvas.height = out.height;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.drawImage(out, 0, 0);

}


/* =========================================================
   TRANSFORM
========================================================= */

function renderTransform(img, s, w, h) {

    const rad = s.rotation * Math.PI / 180;

    const c = Math.abs(Math.cos(rad));
    const si = Math.abs(Math.sin(rad));

    const rw = Math.ceil(w * c + h * si);
    const rh = Math.ceil(w * si + h * c);

    const out = document.createElement("canvas");

    out.width = rw;
    out.height = rh;

    const cxt = out.getContext("2d");

    cxt.save();

    cxt.translate(rw / 2, rh / 2);

    cxt.rotate(rad);

    cxt.scale(
        s.flipH ? -1 : 1,
        s.flipV ? -1 : 1
    );

    cxt.filter = `
    brightness(${100 + s.brightness + s.exposure}%)
    contrast(${100 + s.contrast}%)
    saturate(${100 + s.saturation}%)
  `;

    cxt.drawImage(
        img,
        -w / 2,
        -h / 2,
        w,
        h
    );

    cxt.restore();

    cxt.filter = "none";

    tone(
        cxt,
        rw,
        rh,
        s.shadow,
        s.highlight
    );

    color(
        cxt,
        rw,
        rh,
        s.warmth,
        s.tint
    );

    vignette(
        cxt,
        rw,
        rh,
        s.vignette
    );

    if (s.sharpness > 0)
        sharp(out, s.sharpness);

    return out;

}


/* =========================================================
   EFFECTS
========================================================= */

function tone(c, w, h, shadow, highlight) {

    if (!shadow && !highlight)
        return;

    const d = c.getImageData(0, 0, w, h);
    const p = d.data;

    for (let i = 0; i < p.length; i += 4) {

        let r = p[i];
        let g = p[i + 1];
        let b = p[i + 2];

        const lum = (r + g + b) / 3;

        if (shadow > 0 && lum < 128) {

            const f =
                (1 - lum / 128) *
                shadow / 100 *
                .18;

            r += (255 - r) * f;
            g += (255 - g) * f;
            b += (255 - b) * f;

        }

        if (highlight > 0 && lum > 128) {

            const f =
                ((lum - 128) / 127) *
                highlight / 100 *
                .1;

            r += (255 - r) * f;
            g += (255 - g) * f;
            b += (255 - b) * f;

        }

        p[i] = c255(r);
        p[i + 1] = c255(g);
        p[i + 2] = c255(b);

    }

    c.putImageData(d, 0, 0);

}


function color(c, w, h, warmth, tint) {

    if (!warmth && !tint)
        return;

    c.save();

    c.globalCompositeOperation = "soft-light";

    if (warmth) {

        c.fillStyle =
            warmth > 0
                ? `rgba(255,145,45,${Math.abs(warmth) / 500})`
                : `rgba(35,120,255,${Math.abs(warmth) / 500})`;

        c.fillRect(0, 0, w, h);

    }

    if (tint) {

        c.fillStyle =
            tint > 0
                ? `rgba(255,30,170,${Math.abs(tint) / 600})`
                : `rgba(30,255,120,${Math.abs(tint) / 600})`;

        c.fillRect(0, 0, w, h);

    }

    c.restore();

}


function vignette(c, w, h, v) {

    if (!v)
        return;

    const a = Math.abs(v) / 100;

    const g = c.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * .18,
        w / 2,
        h / 2,
        Math.max(w, h) * .72
    );

    if (v > 0) {

        g.addColorStop(
            0,
            `rgba(255,255,255,${a * .14})`
        );

        g.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );

    } else {

        g.addColorStop(
            0,
            "rgba(0,0,0,0)"
        );

        g.addColorStop(
            1,
            `rgba(0,0,0,${a * .85})`
        );

    }

    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

}


function sharp(out, amount) {

    const a = Math.min(
        .22,
        amount / 100 * .22
    );

    if (a <= 0)
        return;

    const temp = document.createElement("canvas");

    temp.width = out.width;
    temp.height = out.height;

    temp.getContext("2d")
        .drawImage(out, 0, 0);

    const c = out.getContext("2d");

    c.save();

    c.globalAlpha = a;
    c.globalCompositeOperation = "overlay";

    c.drawImage(temp, -1, 0);
    c.drawImage(temp, 1, 0);

    c.restore();

}


function cropNormalized(src, crop) {

    const x = Math.round(crop.x * src.width);
    const y = Math.round(crop.y * src.height);

    const w = Math.max(
        1,
        Math.round(crop.width * src.width)
    );

    const h = Math.max(
        1,
        Math.round(crop.height * src.height)
    );

    const safeX = clamp(x, 0, src.width - 1);
    const safeY = clamp(y, 0, src.height - 1);

    const safeW = Math.min(
        w,
        src.width - safeX
    );

    const safeH = Math.min(
        h,
        src.height - safeY
    );

    const out = document.createElement("canvas");

    out.width = Math.max(1, safeW);
    out.height = Math.max(1, safeH);

    out.getContext("2d")
        .drawImage(
            src,
            safeX,
            safeY,
            out.width,
            out.height,
            0,
            0,
            out.width,
            out.height
        );

    return out;

}


/* =========================================================
   COPY / APPLY
========================================================= */

document.getElementById("copyBtn").onclick = () => {

    if (current < 0)
        return;

    copied = structuredClone(settings);

    setStatus("✓ Edit copied");

};


document.getElementById("applyBtn").onclick = () => {

    if (current < 0)
        return;

    photos.forEach(p => {

        p.settings =
            structuredClone(settings);

        p.replaceError = false;
        p.errorMessage = "";

    });

    renderThumbs();

    setStatus(
        `✓ Applied to ${photos.length} photos`
    );

};


/* =========================================================
   RESET
========================================================= */

document.getElementById("resetBtn").onclick = () => {

    if (current < 0)
        return;

    settings = structuredClone(DEFAULTS);

    saveSettings();

    SLIDERS.forEach(([key]) => {

        document.getElementById(key).value =
            settings[key];

        updateValue(key);

    });

    syncRotation();

    render();

    setStatus("↻ Reset");

};


/* =========================================================
   IMPORTANT:
   SAFE FULL RENDER
========================================================= */

async function renderFull(p) {

    const s = structuredClone(p.settings);

    const img = p.image;

    if (
        !img ||
        !img.naturalWidth ||
        !img.naturalHeight
    )
        throw new Error("Source image is invalid");

    /*
      IMPORTANT:
      Create the full-resolution canvas.
    */

    let out = renderTransform(
        img,
        s,
        img.naturalWidth,
        img.naturalHeight
    );

    if (s.crop)
        out = cropNormalized(out, s.crop);

    if (
        !out.width ||
        !out.height
    )
        throw new Error("Invalid output dimensions");

    /*
      Prevent browser from exporting
      an invalid/empty canvas.
    */

    if (
        out.width < 1 ||
        out.height < 1
    )
        throw new Error("Output canvas is empty");

    /*
      Choose correct MIME.
    */

    let mime = p.type;

    if (mime === "image/jpg")
        mime = "image/jpeg";

    if (
        ![
            "image/jpeg",
            "image/png",
            "image/webp"
        ].includes(mime)
    )
        mime = "image/jpeg";

    const quality =
        mime === "image/png"
            ? undefined
            : .94;

    /*
      toBlob with safety checks.
    */

    const blob =
        await canvasToBlobSafe(
            out,
            mime,
            quality
        );

    /*
      VERY IMPORTANT:
      Never overwrite the original with
      an empty/tiny/corrupted blob.
    */

    if (!blob)
        throw new Error("Canvas returned no blob");

    if (blob.size < 1024)
        throw new Error(
            `Exported image is suspiciously small (${blob.size} bytes)`
        );

    /*
      Decode the exported blob before
      touching the original file.
    */

    await verifyImageBlob(blob);

    return blob;

}


/* =========================================================
   SAFE CANVAS -> BLOB
========================================================= */

function canvasToBlobSafe(
    source,
    mime,
    quality
) {

    return new Promise((resolve, reject) => {

        let finished = false;

        const timeout = setTimeout(() => {

            if (finished)
                return;

            finished = true;

            reject(
                new Error(
                    "Canvas export timed out"
                )
            );

        }, 30000);

        try {

            source.toBlob(
                blob => {

                    if (finished)
                        return;

                    finished = true;

                    clearTimeout(timeout);

                    if (!blob) {

                        reject(
                            new Error(
                                "Canvas toBlob returned null"
                            )
                        );

                        return;

                    }

                    resolve(blob);

                },
                mime,
                quality
            );

        } catch (error) {

            if (finished)
                return;

            finished = true;
            clearTimeout(timeout);

            reject(error);

        }

    });

}


/* =========================================================
   VERIFY EXPORTED IMAGE
========================================================= */

async function verifyImageBlob(blob) {

    if (!blob)
        throw new Error("Missing output blob");

    if (blob.size < 1024)
        throw new Error(
            `Invalid output size: ${blob.size} bytes`
        );

    /*
      Prefer ImageBitmap.
    */

    if ("createImageBitmap" in window) {

        let bitmap = null;

        try {

            bitmap =
                await createImageBitmap(blob);

            if (
                !bitmap.width ||
                !bitmap.height
            )
                throw new Error(
                    "Output image has invalid dimensions"
                );

            bitmap.close();

            return;

        } catch (error) {

            try {
                if (bitmap)
                    bitmap.close();
            } catch (_) { }

            throw new Error(
                "Exported image could not be decoded"
            );

        }

    }

    /*
      Fallback for browsers without ImageBitmap.
    */

    const url = URL.createObjectURL(blob);

    try {

        const img = new Image();

        img.src = url;

        await waitImage(img);

        if (
            !img.naturalWidth ||
            !img.naturalHeight
        )
            throw new Error(
                "Exported image could not be decoded"
            );

    } finally {

        URL.revokeObjectURL(url);

    }

}


/* =========================================================
   SAFE FILE REPLACEMENT
========================================================= */

async function replaceFile(
    handle,
    blob
) {

    if (!handle)
        throw new Error(
            "File handle unavailable"
        );

    /*
      Final protection against writing
      the 700/762 byte corrupted output.
    */

    if (
        !blob ||
        blob.size < 1024
    )
        throw new Error(
            `Refusing to write suspicious blob (${blob?.size || 0} bytes)`
        );

    /*
      Validate blob BEFORE touching file.
    */

    await verifyImageBlob(blob);

    /*
      Ask permission.
    */

    if (handle.queryPermission) {

        let permission =
            await handle.queryPermission({
                mode: "readwrite"
            });

        if (permission !== "granted") {

            permission =
                await handle.requestPermission({
                    mode: "readwrite"
                });

        }

        if (permission !== "granted")
            throw new Error(
                "Write permission denied"
            );

    }

    /*
      Retry the actual write.
  
      This is important because File System
      Access API can occasionally fail while
      opening/writing a writable stream.
    */

    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {

        let writable = null;

        try {

            /*
              keepExistingData:false means the output
              replaces the file contents rather than
              keeping old bytes behind.
            */

            writable =
                await handle.createWritable({
                    keepExistingData: false
                });

            /*
              Write the COMPLETE Blob.
            */

            await writable.write(blob);

            /*
              close() must finish the write.
            */

            await writable.close();

            writable = null;

            /*
              Give filesystem a moment to settle.
            */

            await sleep(120);

            return;

        } catch (error) {

            lastError = error;

            console.warn(
                `File replace attempt ${attempt} failed`,
                error
            );

            /*
              Always abort an unfinished writable.
            */

            if (writable) {

                try {
                    await writable.abort();
                } catch (_) { }

            }

            /*
              Wait before retry.
            */

            if (attempt < 3)
                await sleep(250 * attempt);

        }

    }

    throw new Error(
        "File write failed after 3 attempts: " +
        (
            lastError?.message ||
            "Unknown filesystem error"
        )
    );

}


/* =========================================================
   SINGLE REPLACE
========================================================= */

document.getElementById("saveBtn").onclick =
    async () => {

        if (
            busy ||
            current < 0 ||
            current >= photos.length
        )
            return;

        const index = current;
        const p = photos[index];

        if (!p.handle) {

            setStatus(
                "Use Chrome/Edge and select files with the file picker."
            );

            return;

        }

        busy = true;

        try {

            if (
                cropStage.style.display !== "none"
            ) {

                saveCropState();
                closeCrop();

            }

            setStatus(
                `Rendering ${p.name}...`
            );

            /*
              Render + validate first.
            */

            const blob =
                await renderFull(p);

            setStatus(
                `Replacing ${p.name}...`
            );

            /*
              Replace with retry protection.
            */

            await replaceFile(
                p.handle,
                blob
            );

            /*
              Only remove the photo AFTER
              successful write + close.
            */

            removePhotoAt(index);

            if (photos.length) {

                current =
                    Math.min(
                        index,
                        photos.length - 1
                    );

                loadCurrent();

            } else {

                current = -1;
                resetEmptyUI();

            }

            renderThumbs();
            counter();

            setStatus(
                `✓ Replaced: ${p.name}`
            );

        } catch (error) {

            console.error(
                "Single replace failed:",
                error
            );

            p.replaceError = true;
            p.errorMessage = error.message || "Write failed";

            renderThumbs();

            setStatus(
                `✕ Replace failed: ${p.name}`
            );

        } finally {

            busy = false;

        }

    };


/* =========================================================
   REPLACE ALL — ROBUST VERSION
========================================================= */

document.getElementById("saveAllBtn").onclick =
    async () => {

        if (
            busy ||
            !photos.length
        )
            return;

        if (
            cropStage.style.display !== "none"
        ) {

            saveCropState();
            closeCrop();

        }

        const noHandle =
            photos.some(p => !p.handle);

        if (noHandle) {

            setStatus(
                "Some files have no writable handle. Use Chrome/Edge file picker."
            );

            return;

        }

        busy = true;

        const progress =
            document.getElementById("progress");

        const bar =
            document.getElementById("progressBar");

        progress.style.display = "block";
        bar.style.width = "0%";

        /*
          Snapshot the original queue.
      
          This fixes the old logic where a failed item
          was moved around and the batch could stop
          prematurely.
        */

        const queue = [...photos];

        const total = queue.length;

        let success = 0;
        let failed = 0;

        for (
            let i = 0;
            i < queue.length;
            i++
        ) {

            const p = queue[i];

            /*
              The photo may already have been removed
              after a previous operation. Make sure it
              still exists in the current array.
            */

            const index = photos.indexOf(p);

            if (index === -1)
                continue;

            try {

                p.replaceError = false;
                p.errorMessage = "";

                setStatus(
                    `Rendering ${i + 1} / ${total}: ${p.name}`
                );

                /*
                  1. Render.
                  2. Validate output.
                */

                const blob =
                    await renderFull(p);

                setStatus(
                    `Replacing ${i + 1} / ${total}: ${p.name}`
                );

                /*
                  3. Write.
                  4. close().
                  5. Retry automatically if needed.
                */

                await replaceFile(
                    p.handle,
                    blob
                );

                /*
                  ONLY NOW remove from memory.
                */

                URL.revokeObjectURL(p.url);

                photos.splice(index, 1);

                success++;

                const completed =
                    success + failed;

                bar.style.width =
                    Math.round(
                        completed / total * 100
                    ) + "%";

                renderThumbs();
                counter();

                /*
                  Small delay helps the filesystem
                  settle between many writes.
                */

                await sleep(120);

            } catch (error) {

                console.error(
                    `Replace failed: ${p.name}`,
                    error
                );

                /*
                  Keep failed file in the list.
                */

                p.replaceError = true;
                p.errorMessage =
                    error.message || "Unknown error";

                failed++;

                const completed =
                    success + failed;

                bar.style.width =
                    Math.round(
                        completed / total * 100
                    ) + "%";

                renderThumbs();
                counter();

                /*
                  IMPORTANT:
                  Do NOT remove the failed photo.
                  Do NOT retry endlessly.
                  Continue with next queue item.
                */

                await sleep(200);

            }

        }

        /*
          Select first remaining failed file.
        */

        if (photos.length) {

            current = 0;

            loadCurrent();
            renderThumbs();

            setStatus(
                `✓ ${success} replaced • ✕ ${failed} failed — failed files kept`
            );

        } else {

            current = -1;

            resetEmptyUI();
            renderThumbs();
            counter();

            setStatus(
                `✓ Replace All complete — ${success} photos replaced`
            );

        }

        setTimeout(() => {

            progress.style.display = "none";
            bar.style.width = "0%";

        }, 1500);

        busy = false;

    };


/* =========================================================
   REMOVE
========================================================= */

function removePhotoAt(index) {

    if (
        index < 0 ||
        index >= photos.length
    )
        return;

    const p = photos[index];

    try {
        URL.revokeObjectURL(p.url);
    } catch (_) { }

    photos.splice(index, 1);

}


/* =========================================================
   EMPTY UI
========================================================= */

function resetEmptyUI() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    document.getElementById("emptyState")
        .style.display = "grid";

    document.getElementById("saveBtn")
        .disabled = true;

    document.getElementById("saveAllBtn")
        .disabled = true;

}


/* =========================================================
   CLEAR
========================================================= */

document.getElementById("clearBtn").onclick = () => {

    if (busy)
        return;

    photos.forEach(p => {

        try {
            URL.revokeObjectURL(p.url);
        } catch (_) { }

    });

    photos = [];

    current = -1;

    cropStage.style.display = "none";
    canvas.style.visibility = "visible";

    resetEmptyUI();

    renderThumbs();
    counter();

    setStatus("Photos cleared");

};


/* =========================================================
   HELPERS
========================================================= */

function counter() {

    document.getElementById("counter")
        .textContent =
        `${photos.length} ${photos.length === 1
            ? "image"
            : "images"
        }`;

}


function setStatus(s) {
    status.textContent = s;
}


function waitImage(img) {

    return new Promise((resolve, reject) => {

        if (img.complete) {

            if (img.naturalWidth > 0)
                resolve();
            else
                reject(
                    new Error("Image failed to load")
                );

            return;

        }

        img.onload = resolve;

        img.onerror = () => reject(
            new Error("Image failed to load")
        );

    });

}


function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


function clamp(v, min, max) {

    return Math.max(
        min,
        Math.min(max, v)
    );

}


function c255(v) {

    return Math.max(
        0,
        Math.min(
            255,
            Math.round(v)
        )
    );

}


function esc(s) {

    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

}


/* =========================================================
   INITIAL
========================================================= */

counter();