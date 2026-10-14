require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directories exist
const uploadDirs = ["uploads", "uploads/songs", "uploads/covers"];
uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/spotify_clone";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    seedAdmin();
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Mongoose Schemas & Models
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" }, // 'user' or 'admin'
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
});

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  audioUrl: { type: String, required: true },
  imageUrl: { type: String, required: true },
});

const User = mongoose.model("User", UserSchema);
const Song = mongoose.model("Song", SongSchema);

async function seedAdmin() {
  try {
    const adminEmail = "admin@spotify.com";
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new User({
        name: "Default Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
      });
      await admin.save();
      console.log("Default admin user created: admin@spotify.com / admin123");
    } else {
      console.log("Default admin user already exists");
    }
  } catch (err) {
    console.error("Failed to seed admin user:", err);
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "spotify_clone_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// Serve static frontend files
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Authentication Helper Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.status(403).json({ message: "Forbidden. Admin access required." });
  }
  next();
};

// Multer Storage Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "audioFile") {
      cb(null, "uploads/songs");
    } else if (file.fieldname === "coverFile") {
      cb(null, "uploads/covers");
    } else {
      cb(new Error("Invalid field name"), null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audioFile") {
      if (file.mimetype.startsWith("audio/") || file.originalname.endsWith(".mp3")) {
        cb(null, true);
      } else {
        cb(new Error("Only audio files are allowed!"), false);
      }
    } else if (file.fieldname === "coverFile") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"), false);
      }
    } else {
      cb(null, false);
    }
  },
});

// ==========================================
// API Endpoints
// ==========================================

// Get session info
app.get("/api/me", async (req, res) => {
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        return res.json({ loggedIn: true, name: user.name, role: user.role, email: user.email });
      }
    } catch (err) {
      console.error(err);
    }
  }
  res.json({ loggedIn: false });
});

// Signup Endpoint
app.post("/signup", async (req, res) => {
  const { name, email, password, isAdmin } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: isAdmin === true || isAdmin === "true" ? "admin" : "user",
    });

    await user.save();
    req.session.userId = user._id;
    req.session.role = user.role;

    res.status(201).json({ message: "Registration successful!", user: { name: user.name, role: user.role } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// Login Endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    req.session.userId = user._id;
    req.session.role = user.role;

    res.json({ message: "Login successful!", user: { name: user.name, role: user.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// Logout Endpoint
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Could not log out." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

// ------------------------------------------
// Songs Endpoints
// ------------------------------------------

// Read all songs
app.get("/api/songs", async (req, res) => {
  try {
    const songs = await Song.find({});
    res.json(songs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch songs." });
  }
});

// Create Song (Admin Only)
app.post(
  "/api/songs",
  requireAdmin,
  upload.fields([
    { name: "audioFile", maxCount: 1 },
    { name: "coverFile", maxCount: 1 },
  ]),
  async (req, res) => {
    const { title, artist } = req.body;
    const files = req.files;

    if (!title || !artist || !files || !files.audioFile || !files.coverFile) {
      return res.status(400).json({ message: "Title, artist, audio file, and cover image are all required." });
    }

    try {
      const audioUrl = "/uploads/songs/" + files.audioFile[0].filename;
      const imageUrl = "/uploads/covers/" + files.coverFile[0].filename;

      const newSong = new Song({
        title,
        artist,
        audioUrl,
        imageUrl,
      });

      await newSong.save();
      res.status(201).json({ message: "Song added successfully!", song: newSong });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add song." });
    }
  }
);

// Update Song (Admin Only)
app.put("/api/songs/:id", requireAdmin, async (req, res) => {
  const { title, artist } = req.body;
  if (!title || !artist) {
    return res.status(400).json({ message: "Title and artist are required." });
  }

  try {
    const song = await Song.findByIdAndUpdate(req.params.id, { title, artist }, { new: true });
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
    }
    res.json({ message: "Song updated successfully!", song });
  } catch (err) {
    res.status(500).json({ message: "Failed to update song." });
  }
});

// Delete Song (Admin Only)
app.delete("/api/songs/:id", requireAdmin, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
    }

    // Remove files from filesystem
    const audioPath = path.join(__dirname, song.audioUrl);
    const imagePath = path.join(__dirname, song.imageUrl);

    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    await Song.findByIdAndDelete(req.params.id);

    // Also pull from users' favorites
    await User.updateMany({}, { $pull: { favorites: req.params.id } });

    res.json({ message: "Song deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete song." });
  }
});

// ------------------------------------------
// Favorites Endpoints
// ------------------------------------------

// Get favorites
app.get("/api/favorites", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate("favorites");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch favorites." });
  }
});

// Add to favorites
app.post("/api/favorites/:songId", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.favorites.includes(req.params.songId)) {
      user.favorites.push(req.params.songId);
      await user.save();
    }
    res.json({ message: "Added to favorites!", favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: "Failed to add to favorites." });
  }
});

// Remove from favorites
app.delete("/api/favorites/:songId", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.favorites = user.favorites.filter((id) => id.toString() !== req.params.songId);
    await user.save();
    res.json({ message: "Removed from favorites!", favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove from favorites." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
