/* Frontend that talks to same-origin backend (relative paths)
   - Upload -> POST /upload
   - Thumbnails -> POST /thumbnails
   - Split -> POST /split
   - Concat -> POST /concat
*/
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const video = document.getElementById('video');
const genThumbsBtn = document.getElementById('genThumbsBtn');
const thumbsContainer = document.getElementById('thumbsContainer');
const statusEl = document.getElementById('status');
const addSplitBtn = document.getElementById('addSplitBtn');
const splitList = document.getElementById('splitList');
const splitServerBtn = document.getElementById('splitServerBtn');
const segmentsList = document.getElementById('segmentsList');
const concatBtn = document.getElementById('concatBtn');
const uploadedNameEl = document.getElementById('uploadedName');

let uploadedFilename = null;
let splitTimes = [];
let lastGeneratedThumbs = [];

function log(s){ statusEl.textContent += s + '\n'; statusEl.scrollTop = statusEl.scrollHeight; }
function clearLog(){ statusEl.textContent = ''; }

fileInput.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  video.src = url;
  video.load();
  uploadedFilename = null;
  uploadedNameEl.textContent = '';
  thumbsContainer.innerHTML = '';
  splitTimes = [];
  splitList.innerHTML = '';
  segmentsList.innerHTML = '';
  lastGeneratedThumbs = [];
  clearLog();
  log('Loaded local file in player — click Upload to send it to server.');
});

uploadBtn.addEventListener('click', async ()=>{
  const f = fileInput.files[0];
  if(!f) return alert('Select a local video file first');
  const fd = new FormData(); fd.append('file', f);
  log('Uploading to server...');
  try{
    const res = await fetch('/upload', { method:'POST', body: fd });
    const j = await res.json();
    if(j.error){ log('Upload error: ' + j.error); return; }
    uploadedFilename = j.filename;
    uploadedNameEl.textContent = uploadedFilename;
    log('Upload complete: ' + uploadedFilename);
  } catch(e){ log('Upload failed: ' + e.message); }
});

genThumbsBtn.addEventListener('click', async ()=>{
  if(!uploadedFilename) return alert('Upload file first');
  thumbsContainer.innerHTML = ''; lastGeneratedThumbs = [];
  log('Requesting thumbnails generation...');
  try{
    const res = await fetch('/thumbnails', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ filename: uploadedFilename, count: 24 }) });
    const j = await res.json();
    if(j.error){ log('Thumbs error: ' + j.error); return; }
    log('Thumbnails generated. Rendering...');
    lastGeneratedThumbs = j.thumbs || [];
    for(const t of lastGeneratedThumbs){
      const img = document.createElement('img');
      img.src = t; // relative path served by server
      thumbsContainer.appendChild(img);
    }
    log('Thumbnails displayed.');
  } catch(e){ log('Thumbs failed: ' + e.message); }
});

addSplitBtn.addEventListener('click', ()=>{
  if(!video.src) return alert('Load a video in the player first');
  const t = video.currentTime || 0;
  splitTimes.push(+t.toFixed(3));
  const li = document.createElement('li'); li.className='split-marker'; li.textContent = formatTime(t);
  splitList.appendChild(li);
  log('Added split @ ' + formatTime(t));
});

splitServerBtn.addEventListener('click', async ()=>{
  if(!uploadedFilename) return alert('Upload file first');
  if(splitTimes.length===0) return alert('Add at least one split time');
  log('Requesting server split for times: ' + JSON.stringify(splitTimes));
  try{
    const res = await fetch('/split', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ filename: uploadedFilename, times: splitTimes }) });
    const j = await res.json();
    if(j.error){ log('Split error: ' + j.error); return; }
    log('Server split complete. Segments:');
    segmentsList.innerHTML = '';
    for(const s of j.segments || []){
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = s; a.textContent = s; a.target='_blank';
      li.appendChild(a);
      segmentsList.appendChild(li);
      log(' - ' + s);
    }
  } catch(e){ log('Split failed: ' + e.message); }
});

concatBtn.addEventListener('click', async ()=>{
  const items = Array.from(segmentsList.querySelectorAll('a')).map(a=>a.getAttribute('href').replace(/^\//,''));
  if(items.length===0) return alert('No segments found to concat (split first)');
  log('Requesting concat for ' + JSON.stringify(items));
  try{
    const res = await fetch('/concat', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ files: items }) });
    const j = await res.json();
    if(j.error){ log('Concat error: ' + j.error); return; }
    log('Concat complete. Output: ' + j.output);
    const outUrl = j.output;
    const a = document.createElement('a'); a.href = outUrl; a.textContent = 'Download output'; a.target='_blank';
    segmentsList.appendChild(document.createElement('li')).appendChild(a);
  } catch(e){ log('Concat failed: ' + e.message); }
});

function formatTime(sec){ sec = Math.max(0, Math.floor(sec || 0)); const mm = Math.floor(sec/60); const ss = sec % 60; return mm + ':' + String(ss).padStart(2,'0'); }
