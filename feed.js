let allPosts = [];
let currentSortMode = 'upload'; // 'upload' or 'post'

async function loadFeed() {
  const feedEl = document.getElementById('feed');
  
  try {
    // Загружаем оба JSON
    const [repoRes, postsRes] = await Promise.all([
      fetch('file-repo.json'),
      fetch('posts.json')
    ]);
    
    const repoData = await repoRes.json();
    const postsData = await postsRes.json();
    
    // Создаем карту post_id -> файлы
    const postFiles = {};
    for (const repo of repoData.repositories) {
      for (const file of repo.files) {
        const postId = file.post_id;
        if (!postFiles[postId]) {
          postFiles[postId] = { repo: repo.name, files: [] };
        }
        postFiles[postId].files.push(file);
      }
    }
    
    // Создаем карту post_id -> текст
    const postTexts = {};
    for (const post of postsData) {
      postTexts[post.post_id] = post;
    }
    
    // Собираем все посты
    allPosts = [];
    for (const postId in postFiles) {
      const text = postTexts[postId] || {};
      const files = postFiles[postId].files;
      
      // Находим самую позднюю дату загрузки среди файлов поста
      let latestUpload = null;
      for (const file of files) {
        if (file.uploadedAt) {
          const uploadDate = new Date(file.uploadedAt);
          if (!latestUpload || uploadDate > latestUpload) {
            latestUpload = uploadDate;
          }
        }
      }
      
      allPosts.push({
        id: parseInt(postId),
        text: text.text || '',
        date: text.date || null,
        views: text.views || 0,
        repo: postFiles[postId].repo,
        files: files,
        uploadedAt: latestUpload
      });
    }
    
    renderPosts();
    
  } catch (e) {
    feedEl.innerHTML = `<div class="loading">Ошибка: ${e.message}</div>`;
    console.error(e);
  }
}

function changeSortMode(mode) {
  currentSortMode = mode;
  
  // Обновляем активную кнопку
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderPosts();
}

function renderPosts() {
  const feedEl = document.getElementById('feed');
  
  // Сортируем посты
  const posts = [...allPosts];
  if (currentSortMode === 'upload') {
    // Сортировка по дате загрузки (новые сверху)
    posts.sort((a, b) => {
      if (!a.uploadedAt && !b.uploadedAt) return b.id - a.id;
      if (!a.uploadedAt) return 1;
      if (!b.uploadedAt) return -1;
      return b.uploadedAt - a.uploadedAt;
    });
  } else {
    // Сортировка по ID поста (новые сверху)
    posts.sort((a, b) => b.id - a.id);
  }
  
  feedEl.innerHTML = '';
    
  for (const post of posts) {
    const postEl = document.createElement('div');
    postEl.className = 'post';
    
    // Заголовок поста
    const header = document.createElement('div');
    header.className = 'post-header';
    header.innerHTML = `
      <div class="avatar">�</didv>
      <div class="post-info">
        <div class="post-author">Post #${post.id}</div>
        <div class="post-date">${formatDate(post.date)}</div>
      </div>
    `;
    postEl.appendChild(header);
    
    // Текст поста
    if (post.text) {
      const textEl = document.createElement('div');
      textEl.className = 'post-text';
      textEl.textContent = post.text;
      postEl.appendChild(textEl);
    }
    
    // Медиа
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'post-media';
    
    for (const file of post.files) {
      if (file.encrypted && file.name.endsWith('.enc')) {
        // Зашифрованное фото
        const img = document.createElement('img');
        img.alt = 'Encrypted image';
        img.style.display = 'none';
        
        const btn = document.createElement('button');
        btn.className = 'decrypt-btn';
        btn.textContent = '� Покакзать фото';
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = 'Загрузка...';
          try {
            const key = document.getElementById('key').value.trim();
            const url = rawUrl(post.repo, file.name);
            const r = await fetch(url);
            if (!r.ok) throw new Error('Failed to fetch');
            const ab = await r.arrayBuffer();
            const dec = decryptArrayBuffer(ab, key);
            const blob = new Blob([dec], {type:'image/jpeg'});
            img.src = URL.createObjectURL(blob);
            img.style.display = 'block';
            btn.style.display = 'none';
          } catch(err) {
            alert('Error: ' + err.message);
            btn.disabled = false;
            btn.textContent = '🔓 Показать фото';
          }
        };
        
        mediaContainer.appendChild(btn);
        mediaContainer.appendChild(img);
        
      } else if (file.type === 'hls_raw' && file.name.endsWith('_raw.m3u8')) {
        // HLS видео
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        
        const url = rawUrl(post.repo, file.name);
        
        if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
        }
        
        mediaContainer.appendChild(video);
      }
    }
    
    if (mediaContainer.children.length > 0) {
      postEl.appendChild(mediaContainer);
    }
    
    // Статистика
    const stats = document.createElement('div');
    stats.className = 'post-stats';
    stats.innerHTML = `
      <div class="stat">�️ ${post.v.iews.toLocaleString()}</div>
      <div class="stat">� ${popst.files.length} файлов</div>
    `;
    postEl.appendChild(stats);
    
    feedEl.appendChild(postEl);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'Неизвестно';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days < 7) return `${days} дн назад`;
  
  return date.toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

loadFeed();
