// My travels (travels.html): a low-res pixel map with a pin for every place,
// plus stats. The places come from places.js (made by addplaces.js from
// places.txt); "more animals than people" comes from animals.js.
(function() {
    const data = typeof TRAVELS !== 'undefined' ? TRAVELS : { home: null, places: [], countries: {} };
    const places = data.places;
    const home = data.home;
    const countries = data.countries;
    const UN_TOTAL = 195;
    const WORLD_POPULATION = 8.2e9;

    // ---------- Helpers ----------
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const countryName = code => (countries[code] && countries[code].name) || code;
    // "Provo, Utah" in the US, Canada and Australia; "Kyoto, Japan" elsewhere
    const label = p => p.name + ', ' + (['US', 'CA', 'AU'].includes(p.country) && p.region ? p.region : countryName(p.country));

    function distanceKm(a, b) {
        const rad = d => d * Math.PI / 180;
        const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
        return 2 * 6371 * Math.asin(Math.sqrt(h));
    }

    //////////////////////
    // The pixel map    //
    //////////////////////
    const canvas = document.getElementById('travelMap');
    const wrap = document.getElementById('mapWrap');
    const tip = document.getElementById('mapTip');
    const ctx = canvas.getContext('2d');
    const SCALE = 2;             // each map pixel is 2x2 screen pixels
    const LAT_TOP = 84;          // crop: no Antarctica, not much Arctic
    const LAT_BOTTOM = -58;
    const COLORS = {
        ocean: [47, 95, 158],
        land: [203, 222, 170],
        coast: [120, 150, 95],
        visited: [242, 193, 78],
        visitedCoast: [190, 135, 40]
    };
    let world = null;        // country outlines, decoded once
    let detailedWorld = null; // more detailed outlines, loaded when zoomed in
    let loadingDetail = false;
    const DETAIL_ZOOM = 3;   // zoom level where the detailed outlines kick in
    const MAX_ZOOM = 24;
    let W = 0, H = 0;
    let pinSpots = [];       // where each pin was drawn, for the hover tooltip

    // What the map shows: its center and zoom (1 = whole world)
    const WORLD_VIEW = { lon: 0, lat: (LAT_TOP + LAT_BOTTOM) / 2, zoom: 1 };
    const view = { ...WORLD_VIEW };
    const spanLon = () => 360 / view.zoom;
    const spanLat = () => (LAT_TOP - LAT_BOTTOM) / view.zoom;
    const viewLeft = () => view.lon - spanLon() / 2;
    const viewTop = () => view.lat + spanLat() / 2;

    const project = (lon, lat) => [
        (lon - viewLeft()) / spanLon() * W,
        (viewTop() - lat) / spanLat() * H
    ];
    const unproject = (x, y) => ({
        lon: viewLeft() + x / W * spanLon(),
        lat: viewTop() - y / H * spanLat()
    });

    // Keep the view inside the map
    function clampView() {
        view.zoom = Math.max(1, Math.min(MAX_ZOOM, view.zoom));
        const halfLon = spanLon() / 2;
        const halfLat = spanLat() / 2;
        view.lon = Math.max(-180 + halfLon, Math.min(180 - halfLon, view.lon));
        view.lat = Math.max(LAT_BOTTOM + halfLat, Math.min(LAT_TOP - halfLat, view.lat));
    }

    // Zoom by `factor`, keeping the spot under (x, y) (map pixels) in place
    function zoomAt(factor, x, y) {
        const spot = unproject(x, y);
        view.zoom *= factor;
        clampView();
        view.lon = spot.lon - (x / W - 0.5) * spanLon();
        view.lat = spot.lat + (y / H - 0.5) * spanLat();
        clampView();
        scheduleDraw();
    }

    // The outlines are TopoJSON (shared borders stored once); turn them into
    // a list of countries, each a list of rings of [lon, lat] points.
    function decodeWorld(topo) {
        const [sx, sy] = topo.transform.scale;
        const [tx, ty] = topo.transform.translate;
        const arcs = topo.arcs.map(arc => {
            let x = 0, y = 0;
            return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
        });
        // Shapes that cross the 180° line (Russia, Fiji) jump from one edge of
        // the map to the other; keep them going instead, past the edge.
        // drawRings() then draws a second copy on the other side.
        const ring = ids => {
            const points = ids.flatMap(i => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]));
            let shift = 0;
            return points.map(([lon, lat], i) => {
                if (i) {
                    const prev = points[i - 1][0];
                    if (lon - prev > 180) shift -= 360;
                    else if (prev - lon > 180) shift += 360;
                }
                return [lon + shift, lat];
            });
        };
        return topo.objects.countries.geometries.filter(g => g.id !== '010').map(g => { // 010: Antarctica (cropped off)
            const rings = g.type === 'Polygon' ? g.arcs.map(ring)
                : g.type === 'MultiPolygon' ? g.arcs.flatMap(poly => poly.map(ring)) : [];
            // Bounding box, to skip countries outside the view when zoomed in
            const box = { w: Infinity, e: -Infinity, s: Infinity, n: -Infinity };
            rings.forEach(points => points.forEach(([lon, lat]) => {
                if (lon < box.w) box.w = lon;
                if (lon > box.e) box.e = lon;
                if (lat < box.s) box.s = lat;
                if (lat > box.n) box.n = lat;
            }));
            return { id: g.id, rings, box };
        });
    }

    // Is any copy of this country (it may be drawn again 360° over) in view?
    function inView(country) {
        const left = viewLeft(), right = left + spanLon();
        const top = viewTop(), bottom = top - spanLat();
        const b = country.box;
        if (b.n < bottom || b.s > top) return false;
        return [0, -360, 360].some(o => b.e + o >= left && b.w + o <= right);
    }

    // Fill some countries on a scratch canvas and return which pixels are covered.
    // Covered = more than half filled, so edges come out as hard pixels.
    // With `outline`, it traces the borders instead of filling.
    function mask(list, outline) {
        const scratch = document.createElement('canvas');
        scratch.width = W;
        scratch.height = H;
        const c = scratch.getContext('2d');
        c.fillStyle = '#000';
        c.strokeStyle = '#000';
        c.lineWidth = 1;
        c.beginPath();
        list.forEach(country => country.rings.forEach(points => {
            const lons = points.map(p => p[0]);
            const offsets = [0];
            if (Math.max(...lons) > 180) offsets.push(-360);
            if (Math.min(...lons) < -180) offsets.push(360);
            offsets.forEach(offset => {
                points.forEach(([lon, lat], i) => {
                    const [x, y] = project(lon + offset, lat);
                    if (i) c.lineTo(x, y); else c.moveTo(x, y);
                });
                c.closePath();
            });
        }));
        if (outline) c.stroke(); else c.fill('evenodd');
        const alpha = c.getImageData(0, 0, W, H).data;
        const out = new Uint8Array(W * H);
        const cutoff = outline ? 90 : 128;
        for (let i = 0; i < out.length; i++) out[i] = alpha[i * 4 + 3] >= cutoff ? 1 : 0;
        return out;
    }

    // Pin sprite, 5x7, drawn with its needle tip on the spot
    const PIN = [
        '.RRR.',
        'RWRRR',
        'RRRRR',
        '.RRR.',
        '..N..',
        '..N..',
        '..N..'
    ];
    function drawPin(x, y, head) {
        const shades = { R: head, W: '#ffffff', N: '#333333' };
        PIN.forEach((row, r) => {
            [...row].forEach((ch, c) => {
                if (ch === '.') return;
                ctx.fillStyle = shades[ch];
                ctx.fillRect(x - 2 + c, y - 6 + r, 1, 1);
            });
        });
    }

    function drawMap() {
        if (!world) return;
        const room = wrap.clientWidth - 4;
        W = Math.max(200, Math.min(900, Math.floor(room / SCALE)));
        H = Math.round(W * (LAT_TOP - LAT_BOTTOM) / 360);
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = W * SCALE + 'px';
        canvas.style.height = H * SCALE + 'px';

        clampView();
        // Zoomed in: switch to the detailed outlines (loaded the first time)
        let outlines = world;
        if (view.zoom >= DETAIL_ZOOM) {
            if (detailedWorld) outlines = detailedWorld;
            else if (!loadingDetail) {
                loadingDetail = true;
                fetch('data/world-50m.json')
                    .then(r => r.json())
                    .then(topo => { detailedWorld = decodeWorld(topo); scheduleDraw(); })
                    .catch(() => {}); // keep using the simple outlines
            }
        }
        const shown = outlines.filter(inView);
        const visitedNums = new Set(Object.values(countries).map(c => c.num));
        const land = mask(shown);
        const visited = mask(shown.filter(c => visitedNums.has(c.id)));
        // Borders between countries, once zoomed in enough to have room for them
        const borders = view.zoom >= 2 ? mask(shown, true) : null;

        const image = ctx.createImageData(W, H);
        const px = image.data;
        // (past the map's edge counts as land, so zoomed-in land doesn't get a coastline at the edge)
        const isLand = (x, y) => x < 0 || y < 0 || x >= W || y >= H || land[y * W + x];
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                let color = COLORS.ocean;
                if (land[i]) {
                    // Land next to water gets a darker coastline pixel
                    const coast = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1) ||
                        (borders && borders[i]);
                    if (visited[i]) color = coast ? COLORS.visitedCoast : COLORS.visited;
                    else color = coast ? COLORS.coast : COLORS.land;
                }
                px.set(color, i * 4);
                px[i * 4 + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);

        // Pins, north to south so the lower ones overlap the ones above
        pinSpots = [];
        const pins = places.map(p => {
            const [x, y] = project(p.lon, Math.max(LAT_BOTTOM, Math.min(LAT_TOP, p.lat)));
            return { place: p, x: Math.round(x), y: Math.round(y) };
        }).filter(pin => pin.x > -4 && pin.x < W + 4 && pin.y > -2 && pin.y < H + 8)
          .sort((a, b) => a.y - b.y);
        pins.forEach(pin => {
            const isHome = home && pin.place.name === home.name && Math.abs(pin.place.lat - home.lat) < 0.01;
            drawPin(pin.x, pin.y, isHome ? '#2a6bd6' : '#d8281c');
            pinSpots.push(pin);
        });
    }

    // Hovering a pin shows its name (all the names if pins overlap)
    function showTip(event) {
        if (!W) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (event.clientX - rect.left) / rect.width * W;
        const my = (event.clientY - rect.top) / rect.height * H;
        const near = pinSpots
            .map(pin => ({ pin, d: Math.hypot(pin.x - mx, pin.y - 4 - my) }))
            .filter(o => o.d <= 4)
            .sort((a, b) => a.d - b.d);
        if (!near.length) { tip.hidden = true; return; }
        const names = near.slice(0, 4).map(o => esc(label(o.pin.place)));
        if (near.length > 4) names.push(`and ${near.length - 4} more`);
        tip.innerHTML = names.join('<br>');
        tip.hidden = false;
        const wr = wrap.getBoundingClientRect();
        let left = event.clientX - wr.left + 12;
        const top = event.clientY - wr.top + 14;
        if (left + tip.offsetWidth > wrap.clientWidth) left = event.clientX - wr.left - tip.offsetWidth - 8;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }
    canvas.addEventListener('mousemove', event => { if (!drag) showTip(event); });
    canvas.addEventListener('mouseleave', () => { tip.hidden = true; });

    //////////////////////
    // Zoom and pan     //
    //////////////////////
    // Mouse wheel or double-click to zoom, drag to move around,
    // or the + / - / world buttons in the corner.
    function mapPoint(event) {
        const rect = canvas.getBoundingClientRect();
        return [(event.clientX - rect.left) / rect.width * W, (event.clientY - rect.top) / rect.height * H];
    }

    canvas.addEventListener('wheel', event => {
        if (!W) return;
        event.preventDefault();
        const [x, y] = mapPoint(event);
        zoomAt(Math.pow(2, -event.deltaY / 300), x, y);
        tip.hidden = true;
    }, { passive: false });

    canvas.addEventListener('dblclick', event => {
        const [x, y] = mapPoint(event);
        zoomAt(event.shiftKey ? 0.5 : 2, x, y);
    });

    let drag = null;
    canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        drag = { x: event.clientX, y: event.clientY, lon: view.lon, lat: view.lat, moved: false };
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
        if (!drag) return;
        const rect = canvas.getBoundingClientRect();
        const dx = (event.clientX - drag.x) / rect.width * spanLon();
        const dy = (event.clientY - drag.y) / rect.height * spanLat();
        if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 3) {
            drag.moved = true;
            canvas.classList.add('dragging');
            tip.hidden = true;
        }
        view.lon = drag.lon - dx;
        view.lat = drag.lat + dy;
        scheduleDraw();
    });
    const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    document.getElementById('mapZoomIn').addEventListener('click', () => zoomAt(2, W / 2, H / 2));
    document.getElementById('mapZoomOut').addEventListener('click', () => zoomAt(0.5, W / 2, H / 2));
    document.getElementById('mapZoomWorld').addEventListener('click', () => {
        Object.assign(view, WORLD_VIEW);
        scheduleDraw();
    });

    fetch('data/world-110m.json')
        .then(r => r.json())
        .then(topo => { world = decodeWorld(topo); drawMap(); })
        .catch(() => { wrap.classList.add('map-failed'); });

    let redraw = 0;
    const scheduleDraw = () => { cancelAnimationFrame(redraw); redraw = requestAnimationFrame(drawMap); };
    if (window.ResizeObserver) new ResizeObserver(scheduleDraw).observe(wrap);
    else window.addEventListener('resize', scheduleDraw);

    //////////////////////
    // Stats            //
    //////////////////////
    function panel(name, html) {
        document.getElementById('panel-' + name).innerHTML = html;
    }

    function renderGeneral() {
        const codes = Object.keys(countries);
        const un = codes.filter(c => countries[c].un);
        const territories = codes.filter(c => !countries[c].un);
        const percent = un.length / UN_TOTAL * 100;

        let furthest = null;
        if (home) {
            places.forEach(p => {
                const d = distanceKm(home, p);
                if (!furthest || d > furthest.d) furthest = { p, d };
            });
        }
        const people = places.reduce((sum, p) => sum + (p.pop || 0), 0);

        panel('general', `
            <dl class="travel-stats">
                <dt>Places pinned:</dt>
                <dd class="travel-big">${fmt(places.length)}</dd>

                <dt>Countries:</dt>
                <dd>
                    <span class="travel-big">${un.length}</span> of ${UN_TOTAL}
                    (${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%)<br>
                    <span class="travel-progress"><span style="width:${Math.min(100, percent)}%"></span></span>
                    ${territories.length ? `<div class="travel-note">plus ${territories.map(c => esc(countryName(c))).join(', ')}</div>` : ''}
                </dd>

                <dt>Furthest from home:</dt>
                <dd>${furthest && furthest.d > 1
                    ? `<span class="travel-big">${esc(label(furthest.p))}</span><br>
                       ${fmt(furthest.d)} km (${fmt(furthest.d * 0.621371)} mi) from ${esc(home.name)}`
                    : '<span class="travel-note">Nowhere yet!</span>'}</dd>

                <dt>Population collected:</dt>
                <dd><span class="travel-big">${fmt(people)}</span> people<br>
                    <span class="travel-note">Everyone who lives in the places I've been:
                    ${(people / WORLD_POPULATION * 100).toFixed(people / WORLD_POPULATION < 0.001 ? 3 : 1)}% of the world</span></dd>
            </dl>`);
    }

    function cityTable(list) {
        return `<table class="travel-table">
            <tr><th>#</th><th>City</th><th class="num">Population</th></tr>
            ${list.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(label(p))}</td><td class="num">${fmt(p.pop)}</td></tr>`).join('')}
        </table>`;
    }

    function renderCities() {
        const withPop = places.filter(p => p.pop);
        if (!withPop.length) return panel('cities', '<span class="travel-note">No cities yet.</span>');
        const biggest = withPop.slice().sort((a, b) => b.pop - a.pop).slice(0, 10);
        const smallest = withPop.slice().sort((a, b) => a.pop - b.pop).slice(0, 5);
        const unknown = places.length - withPop.length;
        panel('cities', `
            <h3>Biggest cities</h3>
            ${cityTable(biggest)}
            <h3>Smallest places</h3>
            ${cityTable(smallest)}
            ${unknown ? `<p class="travel-note">${unknown} place${unknown > 1 ? 's have' : ' has'} no population (parks and other spots).</p>` : ''}`);
    }

    function renderFlags() {
        const codes = Object.keys(countries).sort((a, b) => countryName(a).localeCompare(countryName(b)));
        panel('flags', `
            <h3>${codes.length} flag${codes.length === 1 ? '' : 's'} collected</h3>
            <div class="flag-wall">
                ${codes.map(c => `<div class="flag" title="${esc(countryName(c))}">
                    <canvas class="flag-pixels" data-code="${esc(c.toLowerCase())}"></canvas>
                    ${esc(countryName(c))}</div>`).join('')}
            </div>`);
        document.querySelectorAll('.flag-pixels').forEach(pixelFlag);
    }

    // Shrink the flag to a tiny image (12 pixels tall) and show it 3x bigger
    // with hard edges, so it looks low-res like the map
    const FLAG_H = 12;
    const FLAG_ZOOM = 3;
    function pixelFlag(canvas) {
        const img = new Image();
        img.onload = () => {
            const w = Math.max(8, Math.min(24, Math.round(FLAG_H * img.naturalWidth / img.naturalHeight)));
            canvas.width = w;
            canvas.height = FLAG_H;
            const c = canvas.getContext('2d');
            c.imageSmoothingQuality = 'high';
            c.drawImage(img, 0, 0, w, FLAG_H);
            canvas.style.width = w * FLAG_ZOOM + 'px';
            canvas.style.height = FLAG_H * FLAG_ZOOM + 'px';
        };
        img.onerror = () => {
            const box = document.createElement('span');
            box.className = 'flag-missing';
            box.textContent = canvas.dataset.code.toUpperCase();
            canvas.replaceWith(box);
        };
        img.src = 'images/flags/' + canvas.dataset.code + '.png';
    }

    function renderAnimals() {
        const list = typeof ANIMALS_VS_PEOPLE !== 'undefined' ? ANIMALS_VS_PEOPLE : [];
        const beenTo = entry => {
            const [code, region] = entry.where.split(':');
            return places.some(p => p.country === code && (!region || p.region === region));
        };
        const row = (entry, been) => {
            const [animal, count] = entry.animals[0];
            const each = count / entry.people;
            const others = entry.animals.slice(1).map(([a]) => a);
            return `<div class="animal-row${been ? '' : ' not-yet'}">
                ${esc(entry.name)}: <span class="animal-ratio">${each >= 10 ? fmt(each) : each.toFixed(1)} ${esc(animal)}</span> per person
                ${others.length ? `<span class="travel-note">(also more ${others.map(esc).join(' and ')} than people)</span>` : ''}
            </div>`;
        };
        const ratio = e => e.animals[0][1] / e.people;
        const been = list.filter(beenTo).sort((a, b) => ratio(b) - ratio(a));
        const notYet = list.filter(e => !beenTo(e)).sort((a, b) => ratio(b) - ratio(a));
        panel('animals', `
            <h3>Places I've been with more animals than people</h3>
            ${been.length ? been.map(e => row(e, true)).join('') : '<span class="travel-note">None yet. The humans are winning.</span>'}
            ${notYet.length ? `<h3>Still out there</h3>${notYet.map(e => row(e, false)).join('')}` : ''}`);
    }

    // Tabs
    document.querySelectorAll('.travel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.travel-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.travel-panel').forEach(p => { p.hidden = p.id !== 'panel-' + tab.dataset.tab; });
        });
    });

    renderGeneral();
    renderCities();
    renderFlags();
    renderAnimals();
})();
