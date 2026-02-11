// Simple viewer: reads repo-tracker-python.json and loads HLS/MP4 from raw.githubusercontent.com
const GITHUB_USER = 'wq308001';
const GITHUB_BRANCH = 'main';

function encodePath(path){
  return path.split('/').map(encodeURIComponent).join('/');
}

function rawUrl(repo, filePath){
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${repo}/${GITHUB_BRANCH}/${encodePath(filePath)}`;
}

async function rewritePlaylistToRaw(repo, playlistPath, playlistText){
  // Replace relative segment URIs (e.g., "5523.ts") with absolute raw.githubusercontent.com URLs
  const dir = playlistPath.includes('/') ? playlistPath.split('/').slice(0, -1).join('/') : '';
  const lines = playlistText.split('\n');
  const out = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('http')) return line;
    // Likely a segment path or relative resource
    const segPath = dir ? `${dir}/${trimmed}` : trimmed;
    return rawUrl(repo, segPath);
  }).join('\n');
  return out;
}

async function loadList(){
  const listEl = document.getElementById('list');
  try{
    const res = await fetch('repo-tracker-python.json');
    const data = await res.json();
    const repo = data.currentRepo || (data.repositories && data.repositories[0] && data.repositories[0].name) || '';
    if(!repo){ listEl.textContent = 'Не удалось определить репозиторий.'; return; }

    const files = (data.repositories && data.repositories.find(r=>r.name===repo)?.files) || data.repositories?.[0]?.files || [];

    // Prefer *_raw.m3u8 over *_pages.m3u8 when both exist
    const m3u8Map = new Map();
    for(const f of files){
      if(!f.name || !f.name.endsWith('.m3u8')) continue;
      const key = f.name.replace(/_pages|_raw/g, '');
      if(!m3u8Map.has(key)) m3u8Map.set(key, f);
      else if(f.name.includes('_raw')) m3u8Map.set(key, f);
    }

    const m3u8Files = Array.from(m3u8Map.values());
    const mp4Files = files.filter(f=> f.name && f.name.endsWith('.mp4'));
    const videoFiles = m3u8Files.concat(mp4Files);

    if(videoFiles.length===0){ listEl.textContent = 'Видео не найдены в JSON.'; return; }

    listEl.innerHTML = '';
    for(const f of videoFiles){
      const item = document.createElement('div'); item.className='item';
      const meta = document.createElement('div'); meta.className='meta';
      meta.textContent = f.name + (f.type ? ` (${f.type})` : '');
      const link = document.createElement('a');
      link.href = rawUrl(repo, f.name);
      link.textContent = 'Открыть raw';
      link.target = '_blank';
      link.className='link';
      meta.appendChild(link);
      item.appendChild(meta);

      if(f.name.endsWith('.m3u8')){
        const video = document.createElement('video'); video.controls = true;
        item.appendChild(video);

        // Fetch playlist, rewrite relative .ts lines to absolute raw URLs, then load into HLS
        const playlistRawUrl = rawUrl(repo, f.name);
        try{
          const pRes = await fetch(playlistRawUrl);
          if(!pRes.ok) throw new Error('Playlist fetch failed');
          const text = await pRes.text();
          const rewritten = await rewritePlaylistToRaw(repo, f.name, text);
          const blob = new Blob([rewritten], {type: 'application/vnd.apple.mpegurl'});
          const blobUrl = URL.createObjectURL(blob);

          if(window.Hls && Hls.isSupported()){
            const hls = new Hls();
            hls.loadSource(blobUrl);
            hls.attachMedia(video);
          } else if(video.canPlayType('application/vnd.apple.mpegurl')){
            video.src = blobUrl;
          } else {
            const note = document.createElement('div');
            note.textContent = 'Ваш браузер не поддерживает HLS. Откройте raw-ссылку.';
            item.appendChild(note);
          }

        }catch(err){
          console.error('Playlist load error', err);
          const note = document.createElement('div');
          note.textContent = 'Не удалось загрузить плейлист напрямую — откройте raw-ссылку.';
          item.appendChild(note);
        }

      } else if(f.name.endsWith('.mp4')){
        const video = document.createElement('video'); video.controls = true; video.src = rawUrl(repo, f.name);
        item.appendChild(video);
      }

      listEl.appendChild(item);
    }

  }catch(e){
    document.getElementById('list').textContent = 'Ошибка загрузки JSON: '+e.message;
    console.error(e);
  }
}

loadList();
