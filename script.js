console.log("Spotify JS connected");

// Toast Notification Helper
function showToast(message, isError = false) {
  let toastEl = document.getElementById("toastNotification");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "toastNotification";
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.innerText = message;
  if (isError) {
    toastEl.classList.add("error");
  } else {
    toastEl.classList.remove("error");
  }
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}

const playBtn = document.querySelector(".player-btn.play");
const prevBtn = document.querySelector(".player-btn[title='Previous']");
const nextBtn = document.querySelector(".player-btn[title='Next']");
const currentTimeEl = document.querySelector(".current-time");
const totalTimeEl = document.querySelector(".total-time");
const volumeSlider = document.querySelector(".volume-slider");
const seekBar = document.querySelector(".seek-bar");
const topbarActions = document.getElementById("topbarActions");
const adminNavLi = document.getElementById("adminNavLi");
const songContainer = document.getElementById("songContainer");

// Sidebar navigation buttons
const homeBtn = document.getElementById("homeBtn");
const searchBtn = document.getElementById("searchBtn");
const libraryBtn = document.getElementById("libraryBtn");
const playlistBtn = document.getElementById("playlistBtn");
const favoritesBtn = document.getElementById("favoritesBtn");
const downloadsBtn = document.getElementById("downloadsBtn");
const adminBtn = document.getElementById("adminBtn");
const searchSection = document.getElementById("searchSection");
const searchInput = document.getElementById("searchInput");

// Audio State
let songs = []; // Holds current play queue
let currentIndex = 0;
let song = new Audio();
let isPlaying = false;
let currentUser = null;

// ==========================================
// Sidebar Navigation Event Handlers
// ==========================================
if (homeBtn) homeBtn.addEventListener("click", () => window.location.href = "index.html");
if (favoritesBtn) favoritesBtn.addEventListener("click", () => window.location.href = "favorites.html");
if (downloadsBtn) downloadsBtn.addEventListener("click", () => window.location.href = "downloads.html");
if (adminBtn) adminBtn.addEventListener("click", () => window.location.href = "admin.html");
if (libraryBtn) libraryBtn.addEventListener("click", () => showToast("Your Library feature is coming soon!"));
if (playlistBtn) {
  playlistBtn.addEventListener("click", () => {
    const playlistName = prompt("Enter Playlist Name");
    if (playlistName) showToast(`Playlist "${playlistName}" created successfully!`);
  });
}

// Toggle Search Section
if (searchBtn && searchSection && searchInput) {
  searchBtn.addEventListener("click", () => {
    if (searchSection.style.display === "none" || !searchSection.style.display) {
      searchSection.style.display = "block";
      searchInput.focus();
    } else {
      searchSection.style.display = "none";
    }
  });

  searchInput.addEventListener("keyup", () => {
    const value = searchInput.value.toLowerCase();
    document.querySelectorAll(".song-card").forEach(card => {
      const title = card.querySelector("h3").innerText.toLowerCase();
      const artist = card.querySelector("p").innerText.toLowerCase();
      if (title.includes(value) || artist.includes(value)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });
}

// ==========================================
// Authentication & Topbar UI Handling
// ==========================================
async function checkAuth() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    currentUser = data.loggedIn ? data : null;
    
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }
    
    updateTopbarUI();
    
    // Toggle Admin sidebar link
    if (adminNavLi) {
      if (currentUser && currentUser.role === "admin") {
        adminNavLi.style.display = "block";
      } else {
        adminNavLi.style.display = "none";
      }
    }

    // Guard Admin page
    if (window.location.pathname.includes("admin.html")) {
      if (currentUser.role !== "admin") {
        showToast("Access Denied. Admins only.", true);
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1500);
      }
    }
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

function updateTopbarUI() {
  if (!topbarActions) return;

  if (currentUser) {
    topbarActions.innerHTML = `
      <span style="color: #fff; font-weight: bold; margin-right: 15px;">Welcome, ${currentUser.name}</span>
      <button class="login-btn" id="logoutBtn" style="background: #e91429; color: #fff;">Log out</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  } else {
    topbarActions.innerHTML = `
      <button class="signup-btn" onclick="window.location='signup.html'">Sign up</button>
      <button class="login-btn" onclick="window.location='login.html'">Log in</button>
    `;
  }
}

async function handleLogout() {
  try {
    const res = await fetch("/logout", { method: "POST" });
    if (res.ok) {
      showToast("Logged out successfully.", false);
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
    } else {
      showToast("Logout failed.", true);
    }
  } catch (err) {
    console.error("Logout error:", err);
    showToast("Network error. Try again.", true);
  }
}

// ==========================================
// Dynamic Song Player Functionality
// ==========================================

// Play / Pause Bottom Controller
if (playBtn) {
  playBtn.addEventListener("click", () => {
    if (songs.length === 0) return;
    if (isPlaying) {
      song.pause();
      playBtn.innerHTML = "&#9654;"; // Play arrow
      isPlaying = false;
    } else {
      playSong();
    }
  });
}

// Volume Slider
if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    song.volume = volumeSlider.value / 100;
  });
}

// Seek bar updates
song.addEventListener("loadedmetadata", () => {
  if (totalTimeEl) totalTimeEl.innerText = formatTime(song.duration);
});

song.addEventListener("timeupdate", () => {
  if (!isNaN(song.duration)) {
    if (currentTimeEl) currentTimeEl.innerText = formatTime(song.currentTime);
    if (seekBar) seekBar.value = (song.currentTime / song.duration) * 100;
  }
});

if (seekBar) {
  seekBar.addEventListener("input", () => {
    song.currentTime = (seekBar.value / 100) * song.duration;
  });
}

// Next / Prev Controllers
if (nextBtn) nextBtn.addEventListener("click", nextSong);
if (prevBtn) prevBtn.addEventListener("click", prevSong);
song.addEventListener("ended", nextSong);

function playSong() {
  if (songs.length === 0) return;
  
  // Set source
  const currentSong = songs[currentIndex];
  song.src = currentSong.audioUrl;
  song.load();
  song.play()
    .then(() => {
      if (playBtn) playBtn.innerHTML = "⏸";
      isPlaying = true;
    })
    .catch((err) => {
      console.error("Playback error:", err);
    });
}

function nextSong() {
  if (songs.length === 0) return;
  currentIndex = (currentIndex + 1) % songs.length;
  playSong();
}

function prevSong() {
  if (songs.length === 0) return;
  currentIndex = (currentIndex - 1 + songs.length) % songs.length;
  playSong();
}

function formatTime(time) {
  let min = Math.floor(time / 60);
  let sec = Math.floor(time % 60);
  if (sec < 10) sec = "0" + sec;
  return min + ":" + sec;
}

// ==========================================
// Page Specific Initializations
// ==========================================

async function loadMainPageSongs() {
  try {
    const res = await fetch("/api/songs");
    songs = await res.json();
    renderSongCards(songs);
  } catch (err) {
    console.error("Failed to load songs:", err);
  }
}

async function loadFavorites() {
  try {
    const res = await fetch("/api/favorites");
    if (res.status === 401) {
      songContainer.innerHTML = `<p style="padding: 20px; color: var(--muted);">Please log in to view your favorite songs.</p>`;
      return;
    }
    songs = await res.json();
    renderSongCards(songs, true);
  } catch (err) {
    console.error("Failed to load favorites:", err);
  }
}

function loadDownloads() {
  const userKey = currentUser ? `spotify_downloads_${currentUser.email}` : "spotify_downloads";
  const localDownloads = JSON.parse(localStorage.getItem(userKey) || "[]");
  songs = localDownloads;
  renderSongCards(songs, false, true);
}

// Render Songs in Container
function renderSongCards(songsList, isFavoritesPage = false, isDownloadsPage = false) {
  if (!songContainer) return;
  songContainer.innerHTML = "";

  if (songsList.length === 0) {
    songContainer.innerHTML = `<p style="padding: 20px; color: var(--muted);">No songs found here.</p>`;
    return;
  }

  songsList.forEach((s, index) => {
    const card = document.createElement("div");
    card.className = "song-card";
    card.setAttribute("data-id", s._id);

    let actionsHtml = "";
    if (isDownloadsPage) {
      actionsHtml = `
        <button class="card-action-btn delete-download-btn" title="Delete Download">🗑️</button>
      `;
    } else {
      actionsHtml = `
        <button class="card-action-btn favorite-toggle-btn" title="Favorite">❤️</button>
        <button class="card-action-btn download-toggle-btn" title="Download">📥</button>
      `;
    }

    card.innerHTML = `
      <div class="song-cover">
        <img src="${s.imageUrl}" alt="${s.title}" />
        <button class="play-btn">
          <svg viewBox="0 0 24 24" class="play-icon">
            <path d="M8 5v14l11-7z" fill="currentColor"></path>
          </svg>
        </button>
      </div>
      <div class="song-info">
        <h3>${s.title}</h3>
        <p>${s.artist}</p>
      </div>
      <div class="song-card-actions">
        ${actionsHtml}
      </div>
    `;

    // Audio playing on card/play button click
    card.querySelector(".song-cover").addEventListener("click", (e) => {
      e.stopPropagation();
      currentIndex = index;
      playSong();
    });

    // Favorite Button Handler
    const favBtn = card.querySelector(".favorite-toggle-btn");
    if (favBtn) {
      // Check if song is in user's favorites (simulated check / style active)
      if (currentUser && isFavoritesPage) {
        favBtn.classList.add("active");
      }

      favBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!currentUser) {
          showToast("Please log in to add songs to favorites.", true);
          return;
        }

        const isFavorited = favBtn.classList.contains("active") || isFavoritesPage;
        const method = isFavorited ? "DELETE" : "POST";
        
        try {
          const res = await fetch(`/api/favorites/${s._id}`, { method });
          if (res.ok) {
            if (isFavorited) {
              favBtn.classList.remove("active");
              showToast("Removed from favorites!");
              if (isFavoritesPage) {
                loadFavorites(); // Reload favorites page list
              }
            } else {
              favBtn.classList.add("active");
              showToast("Added to favorites!");
            }
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Download Button Handler
    const downBtn = card.querySelector(".download-toggle-btn");
    if (downBtn) {
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        
        // Trigger actual browser download
        const link = document.createElement("a");
        link.href = s.audioUrl;
        link.download = `${s.title} - ${s.artist}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Save to localStorage list
        const userKey = currentUser ? `spotify_downloads_${currentUser.email}` : "spotify_downloads";
        let localDownloads = JSON.parse(localStorage.getItem(userKey) || "[]");
        if (!localDownloads.some(item => item._id === s._id)) {
          localDownloads.push(s);
          localStorage.setItem(userKey, JSON.stringify(localDownloads));
        }
        showToast("Song download started!");
        if (isDownloadsPage) {
          loadDownloads();
        }
      });
    }

    // Delete Download Button Handler
    const deleteDownBtn = card.querySelector(".delete-download-btn");
    if (deleteDownBtn) {
      deleteDownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${s.title}" from downloads?`)) {
          const userKey = currentUser ? `spotify_downloads_${currentUser.email}` : "spotify_downloads";
          let localDownloads = JSON.parse(localStorage.getItem(userKey) || "[]");
          localDownloads = localDownloads.filter(item => item._id !== s._id);
          localStorage.setItem(userKey, JSON.stringify(localDownloads));
          showToast("Removed from downloads.");
          loadDownloads();
        }
      });
    }

    songContainer.appendChild(card);
  });
}

// ==========================================
// Admin Panel Management Page
// ==========================================

const uploadForm = document.getElementById("uploadSongForm");
const adminSongsTableBody = document.getElementById("adminSongsTableBody");
const editModal = document.getElementById("editSongModal");
const editForm = document.getElementById("editSongForm");
const closeModalBtn = document.getElementById("closeModalBtn");

async function loadAdminPanel() {
  try {
    const res = await fetch("/api/songs");
    const adminSongs = await res.json();
    
    if (!adminSongsTableBody) return;
    adminSongsTableBody.innerHTML = "";

    adminSongs.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${s.imageUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" /></td>
        <td>${s.title}</td>
        <td>${s.artist}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${s._id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${s._id}">Delete</button>
        </td>
      `;

      // Delete Handler
      tr.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm(`Are you sure you want to delete "${s.title}"?`)) {
          const deleteRes = await fetch(`/api/songs/${s._id}`, { method: "DELETE" });
          if (deleteRes.ok) {
            showToast("Song deleted successfully!");
            loadAdminPanel();
          } else {
            const err = await deleteRes.json();
            showToast(err.message || "Failed to delete song.", true);
          }
        }
      });

      // Edit Handler
      tr.querySelector(".edit-btn").addEventListener("click", () => {
        document.getElementById("editSongId").value = s._id;
        document.getElementById("editSongTitle").value = s.title;
        document.getElementById("editSongArtist").value = s.artist;
        if (editModal) editModal.style.display = "flex";
      });

      adminSongsTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load admin list:", err);
  }
}

// Upload Form Submission handler
if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("songTitle").value;
    const artist = document.getElementById("songArtist").value;
    const audioFile = document.getElementById("audioFile").files[0];
    const coverFile = document.getElementById("coverFile").files[0];

    const formData = new FormData();
    formData.append("title", title);
    formData.append("artist", artist);
    formData.append("audioFile", audioFile);
    formData.append("coverFile", coverFile);

    const uploadBtn = document.getElementById("uploadBtn");
    uploadBtn.innerText = "Uploading...";
    uploadBtn.disabled = true;

    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        showToast("Song uploaded successfully!");
        uploadForm.reset();
        loadAdminPanel();
      } else {
        const err = await res.json();
        showToast(err.message || "Upload failed.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error uploading song.", true);
    } finally {
      uploadBtn.innerText = "Upload Song";
      uploadBtn.disabled = false;
    }
  });
}

// Edit Form Submission
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editSongId").value;
    const title = document.getElementById("editSongTitle").value;
    const artist = document.getElementById("editSongArtist").value;

    try {
      const res = await fetch(`/api/songs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist }),
      });

      if (res.ok) {
        showToast("Song updated successfully!");
        if (editModal) editModal.style.display = "none";
        loadAdminPanel();
      } else {
        showToast("Failed to update song.", true);
      }
    } catch (err) {
      console.error(err);
    }
  });
}

// Close Modal
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    if (editModal) editModal.style.display = "none";
  });
}

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (editModal && e.target === editModal) {
    editModal.style.display = "none";
  }
});

// ==========================================
// Initialization Router
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();

  if (window.location.pathname.includes("admin.html")) {
    loadAdminPanel();
  } else if (window.location.pathname.includes("favorites.html")) {
    loadFavorites();
  } else if (window.location.pathname.includes("downloads.html")) {
    loadDownloads();
  } else {
    loadMainPageSongs();
  }
});