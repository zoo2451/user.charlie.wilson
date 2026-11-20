// Turns places.txt (your hand-kept list) into places.js, which the
// My travels window (travels.html) reads.
//
//   node addplaces.js
//
// For every line it finds the town in the GeoNames world cities database
// (geonames.org, CC BY 4.0) to get its coordinates, country and population,
// and downloads the country's flag (flagcdn.com) into images/flags.
// The database is downloaded once (about 12 MB) into the .geonames folder,
// which stays on this computer (it's in .gitignore).
// It prints what it matched, so check the list: if it picked the wrong town,
// add the state or country to that line (Paris, Texas).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const LIST = path.join(ROOT, 'places.txt');
const OUT = path.join(ROOT, 'places.js');
const CACHE = path.join(ROOT, '.geonames');
const FLAGS = path.join(ROOT, 'images', 'flags');
const GEONAMES = 'https://download.geonames.org/export/dump/';

// The 193 UN members plus the Vatican and Palestine: "195 countries".
// Anything else (Puerto Rico, Greenland, Kosovo, Taiwan...) is listed as a territory.
const UN_COUNTRIES = (
    'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH ' +
    'CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI ' +
    'FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP ' +
    'KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM ' +
    'NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST ' +
    'SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV ' +
    'UG UA AE GB US UY UZ VU VE VN YE ZM ZW VA PS').split(' ');

// Other names people use for countries
const COUNTRY_ALIASES = {
    'usa': 'US', 'us': 'US', 'u s': 'US', 'u s a': 'US', 'america': 'US', 'united states of america': 'US',
    'uk': 'GB', 'u k': 'GB', 'britain': 'GB', 'great britain': 'GB',
    'czech republic': 'CZ', 'holland': 'NL', 'netherlands': 'NL', 'the netherlands': 'NL', 'korea': 'KR', 'south korea': 'KR',
    'north korea': 'KP', 'vatican': 'VA', 'vatican city': 'VA', 'ivory coast': 'CI', 'burma': 'MM',
    'turkey': 'TR', 'turkiye': 'TR', 'macedonia': 'MK', 'swaziland': 'SZ', 'uae': 'AE',
    'drc': 'CD', 'dr congo': 'CD', 'congo kinshasa': 'CD', 'congo brazzaville': 'CG',
    'republic of the congo': 'CG', 'bosnia': 'BA', 'palestine': 'PS', 'cape verde': 'CV',
    'east timor': 'TL', 'russia': 'RU', 'vietnam': 'VN', 'laos': 'LA', 'syria': 'SY', 'iran': 'IR',
    'bolivia': 'BO', 'venezuela': 'VE', 'tanzania': 'TZ', 'moldova': 'MD', 'brunei': 'BN',
    'micronesia': 'FM', 'st lucia': 'LC', 'saint lucia': 'LC', 'st kitts': 'KN', 'st vincent': 'VC'
};

// Short forms GeoNames doesn't have (it numbers Canada's and Australia's regions)
const REGION_ALIASES = {
    CA: { ab: 'Alberta', bc: 'British Columbia', mb: 'Manitoba', nb: 'New Brunswick',
          nl: 'Newfoundland and Labrador', ns: 'Nova Scotia', on: 'Ontario', pe: 'Prince Edward Island',
          pei: 'Prince Edward Island', qc: 'Quebec', sk: 'Saskatchewan', yt: 'Yukon',
          nt: 'Northwest Territories', nu: 'Nunavut' },
    AU: { act: 'Australian Capital Territory', nsw: 'New South Wales', nt: 'Northern Territory',
          qld: 'Queensland', sa: 'South Australia', tas: 'Tasmania', vic: 'Victoria', wa: 'Western Australia' }
};

// Same spelling rules for the list and the database: no accents, no
// punctuation, "St." = "Saint", "Ft." = "Fort", "Mt." = "Mount"
function norm(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
        .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte')
        .replace(/\bft\b/g, 'fort').replace(/\bmt\b/g, 'mount');
}

function fail(message) {
    console.error('\n' + message + '\n');
    process.exit(1);
}

// ---------- GeoNames (downloaded once) ----------
async function download(url, file) {
    const response = await fetch(url);
    if (!response.ok) fail(`Couldn't download ${url} (${response.status}).`);
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function loadGeoNames() {
    fs.mkdirSync(CACHE, { recursive: true });
    for (const name of ['countryInfo.txt', 'admin1CodesASCII.txt']) {
        const file = path.join(CACHE, name);
        if (!fs.existsSync(file)) {
            console.log(`Downloading ${name} ...`);
            await download(GEONAMES + name, file);
        }
    }
    const citiesFile = path.join(CACHE, 'cities500.txt');
    if (!fs.existsSync(citiesFile)) {
        console.log('Downloading the world cities database (about 12 MB, only this once) ...');
        const zip = path.join(CACHE, 'cities500.zip');
        await download(GEONAMES + 'cities500.zip', zip);
        execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
            'Expand-Archive -Force -LiteralPath $env:ZIP -DestinationPath $env:DEST'],
            { env: { ...process.env, ZIP: zip, DEST: CACHE } });
        fs.rmSync(zip, { force: true });
    }

    const lines = name => fs.readFileSync(path.join(CACHE, name), 'utf8').split('\n')
        .filter(l => l && !l.startsWith('#')).map(l => l.replace(/\r$/, '').split('\t'));

    const countries = {};       // ISO2 -> { name, num }
    const countryByName = {};   // normalized name -> ISO2
    for (const c of lines('countryInfo.txt')) {
        countries[c[0]] = { name: c[4], num: c[2].padStart(3, '0') };
        countryByName[norm(c[4])] = c[0];
        countryByName[norm(c[1])] = c[0]; // three letters: USA, GBR, ...
        // (two-letter codes aren't used: CA, GA, IN... are US states too)
    }
    Object.assign(countryByName, COUNTRY_ALIASES);

    const regions = {};         // 'US.UT' -> 'Utah'
    const regionByName = {};    // normalized name or code -> ['US.UT', ...]
    const addRegion = (k, id) => { (regionByName[k] = regionByName[k] || []).push(id); };
    for (const r of lines('admin1CodesASCII.txt')) {
        regions[r[0]] = r[1];
        addRegion(norm(r[1]), r[0]);
        if (norm(r[2]) !== norm(r[1])) addRegion(norm(r[2]), r[0]);
        const code = r[0].split('.')[1];
        if (/^[A-Z]{2,3}$/.test(code)) addRegion(norm(code), r[0]); // UT, ENG, ...
    }

    for (const [cc, aliases] of Object.entries(REGION_ALIASES)) {
        for (const [short, full] of Object.entries(aliases)) {
            (regionByName[norm(full)] || []).filter(id => id.startsWith(cc + '.')).forEach(id => addRegion(short, id));
        }
    }

    const byName = new Map();   // normalized name -> [city, ...]
    const add = (k, city) => {
        if (!k) return;
        const list = byName.get(k);
        if (!list) byName.set(k, [city]);
        else if (list[list.length - 1] !== city) list.push(city);
    };
    for (const c of lines('cities500.txt')) {
        const city = {
            id: c[0], name: c[1], lat: +c[4], lon: +c[5], code: c[7],
            country: c[8], region: c[8] + '.' + c[10], pop: +c[14] || 0
        };
        add(norm(c[1]), city);
        add(norm(c[2]), city);
        city.alt = c[3];
    }
    return { countries, countryByName, regions, regionByName, byName };
}

// ---------- Reading places.txt ----------
function parseCoords(text) {
    const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const lat = +m[1], lon = +m[2];
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

// "Provo, Utah" -> where it is. Returns { place } or { error }.
function resolve(line, db) {
    const [text, coordText] = line.split('|');
    const parts = text.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return { error: 'empty line' };
    const cityName = parts[0];

    // The other parts say which country and/or state
    let country = null;
    let regionIds = null;
    for (const part of parts.slice(1)) {
        const k = norm(part);
        if (db.countryByName[k] && !country) { country = db.countryByName[k]; continue; }
        if (db.regionByName[k]) { regionIds = db.regionByName[k]; continue; }
        return { error: `don't know "${part}" (a state or country?)` };
    }
    if (regionIds && country) regionIds = regionIds.filter(id => id.startsWith(country + '.'));
    if (regionIds && !regionIds.length) return { error: 'that state isn\'t in that country' };
    // A short form like "WA" can mean a US state or somewhere else (Western
    // Australia): try the US first, then the others.
    const allRegionIds = regionIds;
    if (regionIds && !country && regionIds.length > 1 && regionIds.some(id => id.startsWith('US.'))) {
        regionIds = regionIds.filter(id => id.startsWith('US.'));
        const usOnly = c => regionIds.includes(c.region);
        // (not when coordinates are given: then the US guess stands)
        if (coordText === undefined && !(db.byName.get(norm(cityName)) || []).some(usOnly)) regionIds = allRegionIds;
    }
    const inArea = c => (!country || c.country === country) && (!regionIds || regionIds.includes(c.region));

    // Coordinates given: use them, the name is just a label
    if (coordText !== undefined) {
        const at = parseCoords(coordText);
        if (!at) return { error: 'the coordinates after | should look like 37.2982, -113.0263' };
        const cc = country || (regionIds && regionIds[0].split('.')[0]);
        if (!cc) return { error: 'add the state or country before the | so I know where it is' };
        // If a town by that name is within 25 km, use its population
        const near = (db.byName.get(norm(cityName)) || [])
            .filter(c => c.country === cc && Math.hypot(c.lat - at.lat, (c.lon - at.lon) * Math.cos(at.lat * Math.PI / 180)) < 0.225)
            .sort((a, b) => b.pop - a.pop)[0];
        return { place: { name: cityName, country: cc, region: near ? near.region : (regionIds ? regionIds[0] : null),
            lat: at.lat, lon: at.lon, pop: near ? near.pop || null : null, id: near ? near.id : null } };
    }

    const key = norm(cityName);
    let matches = (db.byName.get(key) || []).filter(inArea);
    if (!matches.length) {
        // Try the other spellings GeoNames knows (Köln = Cologne, ...)
        const wanted = cityName.toLowerCase();
        for (const list of db.byName.values()) {
            for (const c of list) {
                if (inArea(c) && c.alt && c.alt.toLowerCase().split(',').includes(wanted)) matches.push(c);
            }
        }
        matches = [...new Set(matches)];
    }
    if (!matches.length) {
        return { error: 'not found. Check the spelling, or add coordinates: ' + cityName + ', State | lat, lon' };
    }
    // The biggest match wins; neighborhoods (PPLX) only if nothing else
    matches.sort((a, b) => (a.code === 'PPLX') - (b.code === 'PPLX') || b.pop - a.pop);
    const c = matches[0];
    return { place: { name: cityName, country: c.country, region: c.region, lat: c.lat, lon: c.lon, pop: c.pop || null, id: c.id } };
}

function describe(p, db) {
    const region = p.region && db.regions[p.region];
    const where = [p.name, region, db.countries[p.country] ? db.countries[p.country].name : p.country]
        .filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
    return where + (p.pop ? `  (pop. ${p.pop.toLocaleString('en-US')})` : '');
}

// ---------- Flags ----------
async function getFlags(codes) {
    fs.mkdirSync(FLAGS, { recursive: true });
    const failed = [];
    for (const code of codes) {
        const file = path.join(FLAGS, code.toLowerCase() + '.png');
        if (fs.existsSync(file)) continue;
        try {
            const response = await fetch(`https://flagcdn.com/w80/${code.toLowerCase()}.png`);
            if (!response.ok) throw new Error(response.status);
            fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
        } catch (e) {
            failed.push(code);
        }
    }
    return failed;
}

// ---------- Main ----------
(async () => {
    if (!fs.existsSync(LIST)) fail('There is no places.txt.');
    const db = await loadGeoNames();

    const rows = fs.readFileSync(LIST, 'utf8').split(/\r?\n/)
        .map((text, i) => ({ text: text.trim(), lineNo: i + 1 }))
        .filter(r => r.text && !r.text.startsWith('#'));

    let home = null;
    const places = [];
    const seen = new Set();
    const problems = [];
    for (const row of rows) {
        const isHome = /^home\s*:/i.test(row.text);
        // "| pop 116" sets the population yourself (it wins over the database)
        let popOverride = null;
        const segments = row.text.replace(/^home\s*:/i, '').split('|').filter(seg => {
            const m = seg.trim().match(/^pop(?:ulation)?\s*:?\s*([\d,]+)$/i);
            if (m) popOverride = Number(m[1].replace(/,/g, ''));
            return !m;
        });
        const result = resolve(segments.join('|'), db);
        if (result.error) { problems.push(`  line ${row.lineNo}: ${row.text}  ->  ${result.error}`); continue; }
        const p = result.place;
        if (popOverride !== null) p.pop = popOverride || null;
        if (isHome) { home = p; continue; }
        const key = p.id || `${p.name}|${p.lat}|${p.lon}`;
        if (seen.has(key)) continue; // listed twice
        seen.add(key);
        places.push(p);
        console.log(`  ${row.text.padEnd(32)} -> ${describe(p, db)}`);
    }
    if (!home) fail('Add a line like  home: Provo, Utah  to places.txt.');

    const codes = [...new Set(places.map(p => p.country))].sort();
    const countries = {};
    codes.forEach(code => {
        const c = db.countries[code] || { name: code, num: '' };
        countries[code] = { name: c.name, num: c.num, un: UN_COUNTRIES.includes(code) };
    });

    const round = n => Math.round(n * 1e4) / 1e4;
    const data = {
        home: { name: home.name, region: db.regions[home.region] || '', lat: round(home.lat), lon: round(home.lon) },
        places: places.map(p => ({
            name: p.name,
            region: db.regions[p.region] || '',
            country: p.country,
            lat: round(p.lat),
            lon: round(p.lon),
            pop: p.pop
        })),
        countries
    };
    fs.writeFileSync(OUT,
        '// Made by addplaces.js from places.txt. Edit places.txt, not this file.\n' +
        '// City data: GeoNames (geonames.org), CC BY 4.0.\n' +
        'const TRAVELS = ' + JSON.stringify(data, null, 1) + ';\n');

    const noFlag = await getFlags(codes);

    console.log(`\n${places.length} places in ${codes.length} countries/territories. Saved places.js.`);
    if (noFlag.length) console.log(`Couldn't get flags for: ${noFlag.join(', ')} (run it again later).`);
    if (problems.length) {
        console.log(`\n${problems.length} line(s) skipped. Fix them in places.txt and run again:`);
        problems.forEach(p => console.log(p));
    }
    console.log('\nPush to GitHub to put it online.');
})().catch(e => fail('Something went wrong: ' + e.message));
