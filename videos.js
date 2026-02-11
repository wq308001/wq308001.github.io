// Simple viewer: reads repo-tracker-python.json and tries to load files
const GITHUB_USER = 'wq308001';

function encodePath(path){
  return path.split('/').map(encodeURIComponent).join('/');
}

function rawUrl(repo, filePath){
  // Assumes branch 'main'
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${repo}/main/${encodePath(filePath)}`;
}

async function loadList(){
  const listEl = document.getElementById('list');
  try{
    const res = await fetch('repo-tracker-python.json');
    const data = await res.json();
    const repo = data.currentRepo || (data.repositories && data.repositories[0] && data.repositories[0].name) || '';
    if(!repo){ listEl.textContent = 'Не удалось определить репозиторий.'; return; }

    const files = (data.repositories && data.repositories.find(r=>r.name===repo)?.files) || data.repositories?.[0]?.files || [];
    const videoFiles = files.filter(f=> typeof f.name === 'string' && (f.name.endsWith('.m3u8') || f.name.endsWith('.mp4')) );
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

      const url = rawUrl(repo, f.name);
      if(f.name.endsWith('.m3u8')){
        const video = document.createElement('video'); video.controls = true;
        item.appendChild(video);
        if(window.Hls && Hls.isSupported()){
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
        } else if(video.canPlayType('application/vnd.apple.mpegurl')){
          video.src = url;
        } else {
          const note = document.createElement('div');
          note.textContent = 'Ваш браузер не поддерживает HLS. Откройте raw-ссылку.';
          item.appendChild(note);
        }
      } else if(f.name.endsWith('.mp4')){
        const video = document.createElement('video'); video.controls = true; video.src = url;
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
