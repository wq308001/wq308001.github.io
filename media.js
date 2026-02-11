// Общие константы
window.GITHUB_USER = 'wq308001';
const GITHUB_BRANCH = 'main';

function encodePath(path){
  return path.split('/').map(encodeURIComponent).join('/');
}

function rawUrl(repo, filePath){
  return `https://raw.githubusercontent.com/${window.GITHUB_USER}/${repo}/${GITHUB_BRANCH}/${encodePath(filePath)}`;
}

// ============= ВИДЕО =============

async function loadVideos(){
  const listEl = document.getElementById('videos-list');
  try{
    const res = await fetch('file-repo.json');
    const data = await res.json();
    
    if(!data.repositories || data.repositories.length === 0){ 
      listEl.textContent = 'Репозитории не найдены.'; 
      return; 
    }

    // Собираем все плейлисты из всех репо
    const playlists = [];
    for(const repo of data.repositories){
      const files = repo.files || [];
      for(const f of files){
        // Берем только _raw.m3u8 плейлисты (они содержат raw.githubusercontent.com URLs)
        if(typeof f.name === 'string' && f.name.endsWith('_raw.m3u8')){
          playlists.push({
            name: f.name,
            repo: repo.name,
            type: f.type || 'hls',
            segments: f.segments || 0,
            post_id: f.post_id,
            uploadedAt: f.uploadedAt
          });
        }
      }
    }

    if(playlists.length === 0){ 
      listEl.textContent = 'Видео не найдены в JSON.'; 
      return; 
    }

    // Сортируем по дате загрузки (новые сверху)
    playlists.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || 0);
      const dateB = new Date(b.uploadedAt || 0);
      return dateB - dateA;
    });

    listEl.innerHTML = '';
    for(const f of playlists){
      const item = document.createElement('div'); 
      item.className='item';
      
      const meta = document.createElement('div'); 
      meta.className='meta';
      
      // Извлекаем имя видео из пути (убираем hls_timestamp/ и _raw.m3u8)
      const videoName = f.name.split('/').pop().replace('_raw.m3u8', '');
      meta.textContent = `${videoName} (${f.segments} сегментов, post ${f.post_id})`;
      
      const link = document.createElement('a');
      link.href = rawUrl(f.repo, f.name);
      link.textContent = 'Открыть плейлист';
      link.target = '_blank';
      link.className='link';
      meta.appendChild(link);
      item.appendChild(meta);

      const url = rawUrl(f.repo, f.name);
      const video = document.createElement('video'); 
      video.controls = true;
      item.appendChild(video);
      
      if(window.Hls && Hls.isSupported()){
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if(video.canPlayType('application/vnd.apple.mpegurl')){
        video.src = url;
      } else {
        const note = document.createElement('div');
        note.textContent = 'Ваш браузер не поддерживает HLS. Откройте плейлист вручную.';
        item.appendChild(note);
      }

      listEl.appendChild(item);
    }

  }catch(e){
    listEl.textContent = 'Ошибка загрузки JSON: '+e.message;
    console.error(e);
  }
}

// ============= ФОТО =============

function wordArrayToUint8Array(wordArray){
  const words = wordArray.words; 
  const sigBytes = wordArray.sigBytes; 
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) { 
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff; 
  }
  return u8;
}

function decryptArrayBuffer(encryptedArrayBuffer, keyHex){
  const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
  const iv = CryptoJS.lib.WordArray.create(encryptedBytes.slice(0,16));
  const ciphertext = CryptoJS.lib.WordArray.create(encryptedBytes.slice(16));
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const decrypted = CryptoJS.AES.decrypt({ciphertext}, key, { 
    iv, 
    mode: CryptoJS.mode.CBC, 
    padding: CryptoJS.pad.Pkcs7 
  });
  return wordArrayToUint8Array(decrypted).buffer;
}

async function loadImages(){
  const listEl = document.getElementById('images-list');
  try{
    const res = await fetch('file-repo.json');
    const data = await res.json();
    
    if(!data.repositories || data.repositories.length === 0){ 
      listEl.textContent = 'Repositories not found'; 
      return; 
    }
    
    // Собираем все зашифрованные фото из всех репо
    const images = [];
    for(const repo of data.repositories){
      const files = repo.files || [];
      for(const f of files){
        if(f.name && f.name.match(/photo_.*\.(jpg|jpeg|png|gif)\.enc$/i) && f.encrypted){
          images.push({
            name: f.name,
            repo: repo.name,
            size: f.size,
            post_id: f.post_id,
            uploadedAt: f.uploadedAt
          });
        }
      }
    }
    
    if(images.length === 0){ 
      listEl.textContent = 'No encrypted images found'; 
      return; 
    }
    
    // Сортируем по дате (новые сверху)
    images.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || 0);
      const dateB = new Date(b.uploadedAt || 0);
      return dateB - dateA;
    });
    
    listEl.innerHTML = '';
    for(const f of images){
      const card = document.createElement('div'); 
      card.className='card';
      
      const title = document.createElement('div'); 
      title.textContent = `${f.name.split('/').pop()} (post ${f.post_id}, ${(f.size/1024).toFixed(1)}KB)`;
      
      const img = document.createElement('img'); 
      img.alt = f.name; 
      img.src = '';
      
      const btn = document.createElement('button'); 
      btn.textContent = 'Decrypt & Show';
      btn.onclick = async ()=>{
        btn.disabled = true; 
        btn.textContent = 'Loading...';
        try{
          const key = document.getElementById('key').value.trim();
          const url = rawUrl(f.repo, f.name);
          const r = await fetch(url);
          if(!r.ok) throw new Error('Failed to fetch');
          const ab = await r.arrayBuffer();
          const dec = decryptArrayBuffer(ab, key);
          const blob = new Blob([dec], {type:'image/jpeg'});
          img.src = URL.createObjectURL(blob);
        }catch(err){
          alert('Error: '+err.message);
        }finally{ 
          btn.disabled=false; 
          btn.textContent='Decrypt & Show'; 
        }
      };
      
      card.appendChild(title); 
      card.appendChild(img); 
      card.appendChild(btn);
      listEl.appendChild(card);
    }
  }catch(e){ 
    listEl.textContent = 'Error: '+e.message; 
  }
}
