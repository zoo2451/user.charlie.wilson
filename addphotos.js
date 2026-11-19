// Moves the photos in images/screening into a year's gallery.
//
//   node addphotos.js 2026
//
// For every photo in images/screening it:
//   1. uploads it to ImageKit, folder gallery2026 (this is what the website shows)
//   2. puts it in images/gallery2026 and a 700px-wide copy in images/gallery2026/thumbs
//   3. adds its name to photogallery2026.js, so it appears on 2026.html
//   4. removes it from images/screening
// It shows what it's about to do and waits for "y" before changing anything.
// A photo that fails to upload stays in screening, so you can just run it again.
//
// Options:
//   --date 11_19_26   rename the photos film_11_19_26, film_11_19_26B, C, ...
//   --only IMG_4116.JPG,IMG_4118.JPG   move just these photos
//   --no-upload       skip ImageKit (local folders and the list only)
//   --dry-run         just show the plan
//   --yes             don't ask before starting
//
// ImageKit needs your PRIVATE key (ImageKit dashboard > Developer options).
// It must never go on GitHub, so it lives outside this folder, in a file named
// .imagekit_private_key in your user folder (C:\Users\<you>\), or in the
// IMAGEKIT_PRIVATE_KEY environment variable.
// After uploading, push to GitHub as usual so the updated list goes live.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SCREENING = path.join(ROOT, 'images', 'screening');
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const THUMB_WIDTH = 700;
const KEY_FILE = path.join(os.homedir(), '.imagekit_private_key');
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const FILES_URL = 'https://api.imagekit.io/v1/files';

// ---------- Options ----------
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const year = args.find(a => /^\d{4}$/.test(a));
const date = option('--date');
const only = option('--only');
const upload = !flag('--no-upload');
const dryRun = flag('--dry-run');

function fail(message) {
    console.error('\n' + message + '\n');
    process.exit(1);
}

if (!year) fail('Which year? For example:  node addphotos.js 2026');
if (date && !/^\d\d_\d\d_\d\d(\d\d)?$/.test(date)) fail('--date should look like 11_19_26');

const listFile = path.join(ROOT, `photogallery${year}.js`);
const yearDir = path.join(ROOT, 'images', `gallery${year}`);
const thumbDir = path.join(yearDir, 'thumbs');
const ikFolder = `/gallery${year}`;
if (!fs.existsSync(listFile)) {
    fail(`There's no photogallery${year}.js yet. Make the ${year} page first (copy 2026.html and photogallery2026.js).`);
}

// ---------- The photo list (photogallery<year>.js) ----------
function readList() {
    const text = fs.readFileSync(listFile, 'utf8');
    const start = text.indexOf('[', text.indexOf('imageFilenames'));
    const end = text.lastIndexOf('];');
    if (start < 0 || end < start) fail(`Couldn't find the imageFilenames list in ${path.basename(listFile)}.`);
    const names = [...text.slice(start, end).matchAll(/"([^"]+)"/g)].map(m => m[1]);
    return { text, end, names };
}

function addToList(newNames) {
    const { text, end } = readList();
    let before = text.slice(0, end).replace(/\s*$/, '');
    if (!before.endsWith('[') && !before.endsWith(',')) before += ',';
    const lines = newNames.map(n => `    "${n}"`).join(',\n');
    fs.writeFileSync(listFile, before + '\n' + lines + '\n' + text.slice(end));
}

// ---------- ImageKit ----------
function imageKitAuth() {
    let key = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!key && fs.existsSync(KEY_FILE)) key = fs.readFileSync(KEY_FILE, 'utf8');
    key = (key || '').trim();
    if (!key) {
        fail(`No ImageKit private key found. Put it in ${KEY_FILE}\n` +
             '(one line, nothing else), or run with --no-upload.');
    }
    if (!key.startsWith('private_')) fail(`The key in ${KEY_FILE} doesn't look like a private key (they start with "private_").`);
    return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

async function imageKitNames(auth) {
    const names = [];
    for (let skip = 0; ; skip += 1000) {
        const url = `${FILES_URL}?path=${encodeURIComponent(ikFolder)}&type=file&limit=1000&skip=${skip}`;
        const response = await fetch(url, { headers: { Authorization: auth } });
        if (!response.ok) {
            const body = await response.text();
            fail(`ImageKit said no (${response.status}): ${body.slice(0, 200)}\nCheck the private key.`);
        }
        const page = await response.json();
        page.forEach(f => names.push(f.name));
        if (page.length < 1000) return names;
    }
}

async function uploadPhoto(auth, file, name) {
    const form = new FormData();
    form.append('file', await fs.openAsBlob(file));
    form.append('fileName', name);
    form.append('folder', ikFolder);
    form.append('useUniqueFileName', 'false');
    form.append('overwriteFile', 'false');
    const response = await fetch(UPLOAD_URL, { method: 'POST', headers: { Authorization: auth }, body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
    if (result.name !== name) throw new Error(`ImageKit saved it as ${result.name}`);
}

// ---------- Thumbnails ----------
// Windows' built-in image tools, so there's nothing to install
function makeThumbs(pairs) {
    if (!pairs.length) return [];
    const jobs = path.join(os.tmpdir(), `addphotos-${process.pid}.json`);
    fs.writeFileSync(jobs, JSON.stringify(pairs.map(([src, dst]) => ({ src, dst }))));
    const script = `
        Add-Type -AssemblyName System.Drawing
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
        $params = New-Object System.Drawing.Imaging.EncoderParameters 1
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 85L
        foreach ($job in (Get-Content -Raw -LiteralPath $env:ADDPHOTOS_JOBS | ConvertFrom-Json)) {
            try {
                $img = [System.Drawing.Image]::FromFile($job.src)
                # Turn it the right way up if the camera recorded a rotation
                if ($img.PropertyIdList -contains 274) {
                    switch ($img.GetPropertyItem(274).Value[0]) {
                        3 { $img.RotateFlip('Rotate180FlipNone') }
                        6 { $img.RotateFlip('Rotate90FlipNone') }
                        8 { $img.RotateFlip('Rotate270FlipNone') }
                    }
                }
                $w = [Math]::Min(${THUMB_WIDTH}, $img.Width)
                $h = [int]([Math]::Round($img.Height * $w / $img.Width))
                $thumb = New-Object System.Drawing.Bitmap $w, $h
                $g = [System.Drawing.Graphics]::FromImage($thumb)
                $g.InterpolationMode = 'HighQualityBicubic'
                $g.DrawImage($img, 0, 0, $w, $h)
                $thumb.Save($job.dst, $codec, $params)
                $g.Dispose(); $thumb.Dispose(); $img.Dispose()
                "ok"
            } catch { "fail" }
        }`;
    try {
        const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', env: { ...process.env, ADDPHOTOS_JOBS: jobs } });
        return out.split(/\r?\n/).filter(Boolean);
    } catch (e) {
        return pairs.map(() => 'fail');
    } finally {
        fs.rmSync(jobs, { force: true });
    }
}

// ---------- Plan ----------
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); }));
}

// Names ImageKit accepts: letters, numbers, dot, dash, underscore
const cleanName = name => name.replace(/[^\w.-]/g, '_');

(async () => {
    if (!fs.existsSync(SCREENING)) fail('There is no images/screening folder.');
    let files = fs.readdirSync(SCREENING).filter(f => IMAGE_EXT.test(f) && fs.statSync(path.join(SCREENING, f)).isFile());
    if (only) {
        const wanted = only.split(',').map(s => s.trim().toLowerCase());
        files = files.filter(f => wanted.includes(f.toLowerCase()));
    }
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!files.length) fail('No photos to move in images/screening.');

    const auth = upload ? imageKitAuth() : null;
    if (upload) console.log(`Checking what's already in ImageKit ${ikFolder} ...`);
    const online = upload ? await imageKitNames(auth) : [];

    // Names already used, so nothing gets overwritten. A name that's in the
    // list but missing from ImageKit is allowed: uploading it fills the gap.
    const lower = names => new Set(names.map(n => n.toLowerCase()));
    const listed = lower(readList().names);
    const taken = lower([...online, ...(fs.existsSync(yearDir) ? fs.readdirSync(yearDir) : [])]);

    const plan = [];
    const skipped = [];
    let letter = 0; // for --date: '', B, C, ...
    for (const file of files) {
        const ext = path.extname(file);
        let name;
        if (date) {
            const used = n => taken.has(n.toLowerCase()) || listed.has(n.toLowerCase());
            do {
                const suffix = letter === 0 ? '' : String.fromCharCode(65 + letter); // B = 1
                name = `film_${date}${suffix}${ext}`;
                letter++;
            } while (used(name) && letter < 26);
            if (used(name)) {
                skipped.push(`${file}  (ran out of letters for ${date})`);
                continue;
            }
        } else {
            name = cleanName(file);
        }
        if (taken.has(name.toLowerCase())) {
            skipped.push(`${file}  (${name} is already in the ${year} gallery)`);
            continue;
        }
        taken.add(name.toLowerCase());
        plan.push({ file, name, listed: listed.has(name.toLowerCase()) });
    }

    console.log(`\n${plan.length} photo(s) going to ${year}:` + (upload ? '' : '   (no upload)'));
    plan.forEach(p => console.log('  ' + (p.file === p.name ? p.name : `${p.file}  ->  ${p.name}`) +
        (p.listed ? '   (already in the list, adding the missing photo)' : '')));
    if (skipped.length) {
        console.log(`\nSkipping ${skipped.length} (rename them, or use --date):`);
        skipped.forEach(s => console.log('  ' + s));
    }
    if (!plan.length || dryRun) return;

    if (!flag('--yes')) {
        const answer = await ask('\nGo ahead? (y/n) ');
        if (answer !== 'y' && answer !== 'yes') return console.log('Nothing changed.');
    }

    fs.mkdirSync(thumbDir, { recursive: true });
    const done = [];
    for (const [i, p] of plan.entries()) {
        const src = path.join(SCREENING, p.file);
        process.stdout.write(`[${i + 1}/${plan.length}] ${p.name} ... `);
        if (upload) {
            try {
                await uploadPhoto(auth, src, p.name);
            } catch (e) {
                console.log(`upload failed (${e.message}), left in screening`);
                continue;
            }
        }
        fs.copyFileSync(src, path.join(yearDir, p.name));
        done.push(p);
        console.log(upload ? 'uploaded' : 'copied');
    }
    if (!done.length) return console.log('\nNothing was moved.');

    console.log('Making thumbnails ...');
    const results = makeThumbs(done.map(p => [path.join(yearDir, p.name), path.join(thumbDir, p.name)]));
    const noThumb = done.filter((p, i) => results[i] !== 'ok');

    const newNames = done.filter(p => !p.listed).map(p => p.name);
    if (newNames.length) addToList(newNames);
    done.forEach(p => fs.rmSync(path.join(SCREENING, p.file)));

    console.log(`\nDone: ${done.length} photo(s) added to photogallery${year}.js and moved out of screening.`);
    if (noThumb.length) console.log(`No thumbnail for: ${noThumb.map(p => p.name).join(', ')}`);
    if (done.length < plan.length) console.log(`${plan.length - done.length} didn't upload; they're still in screening.`);
    console.log('Push to GitHub to put the new list online.');
})().catch(e => fail('Something went wrong: ' + e.message));
