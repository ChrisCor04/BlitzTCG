import express from 'express';
import { getUsers, createuser } from './test.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Node 18+ has fetch built-in, otherwise install 'node-fetch'
import TCGdex, { Query } from '@tcgdex/sdk'; 

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

const BASE_URL = "https://api.justtcg.com/v1";
const HEADERS = { "x-api-key": process.env.JUSTTCG_API_KEY };

const tcgdex = new TCGdex(`en`)
// =======================
// Existing Login Route
// =======================
app.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

        const users = await getUsers();
        const user = users.find(u => u.email === email && u.pass === password);
        if (!user) return res.status(401).json({ error: 'Password or Email is incorrect' });

        return res.status(200).json({ 
        message: 'Login successful',
        email: user.email,      // 👈 so frontend can store it
        name: user.username     // optional, if you want to display it
        });

    } catch (error) {
        next(error);
    }
});

// =======================
// Existing Signup Route
// =======================
app.post('/signup', async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !password || !name) return res.status(400).json({ error: 'Name, Email and password are required.' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format.' });

        await createuser(name, email, password);
        return res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =======================
// New Route: Get Set ID from JustTCG
// =======================
app.get('/get-set-id', async (req, res) => {
    const setName = req.query.setName;
    const gameName = req.query.gameName || "Pokemon";

    if (!setName) return res.status(400).json({ error: "Missing setName parameter" });

    try {
        const url = `${BASE_URL}/sets?game=${encodeURIComponent(gameName)}`;
        const response = await fetch(url, { headers: HEADERS });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const sets = data.data;

        const foundSet = sets.find(s => s.name.toLowerCase() === setName.toLowerCase());

        if (foundSet) return res.json({ setId: foundSet.id });
        return res.status(404).json({ error: "Set not found" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});
app.post('/search-card', async (req, res) => {
    const { query, gameName, setId } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    const gameId = (gameName || 'Pokemon').toLowerCase();

    try {
        const url = new URL(`${BASE_URL}/cards`);
        url.searchParams.set("game", gameId);
        url.searchParams.set("q", query);
        url.searchParams.set("limit", "20");
        url.searchParams.set("offset", "0");
        url.searchParams.set("include_price_history", "false");
        url.searchParams.set("include_statistics", "7d");

        // If you already resolved a setId via /get-set-id, you can pass it from the client:
        if (setId) {
            url.searchParams.set("set", setId);
        }

        const response = await fetch(url.toString(), { headers: HEADERS });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            console.error("JustTCG error:", body);
            return res.status(response.status).json({
                error: body.error || `JustTCG error (status ${response.status})`,
            });
        }

        const data = await response.json();

        // Just pass the JustTCG data through; the client will decide what to do
        return res.json({
            data: data.data || [],
            meta: data.meta || null,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error while searching card" });
    }
});

app.get('/pokemon-image', async (req, res) => {
  const { setName, number } = req.query;

  if (!setName || !number) {
    return res.status(400).json({ error: "Missing 'setName' or 'number' query param" });
  }

  // JustTCG numbers look like "136/189" – TCGdex wants just "136"
  const localIdStr = String(number).split('/')[0].trim();

  // --- Normalize the set name from JustTCG ---
  let cleanSetName = String(setName)
    .replace(/\\+$/g, '')   // remove trailing backslashes
    .trim();

  // If it has a prefix like "SWSH03: Darkness Ablaze", keep only the part after ":"
  const colonIndex = cleanSetName.indexOf(':');
  if (colonIndex !== -1) {
    const after = cleanSetName.slice(colonIndex + 1).trim();
    if (after.length > 0) {
      cleanSetName = after;
    }
  }

  try {
    // 1) Find the set by (normalized) name using a more forgiving search
    const sets = await tcgdex.set.list(
      Query.create().contains('name', cleanSetName)
    );

    if (!sets || sets.length === 0) {
      console.log("TCGdex set not found for cleaned name:", cleanSetName, "raw:", setName);
      return res.status(404).json({ error: "No matching TCGdex set found" });
    }

    // Prefer exact match on cleaned name if it exists
    let set = sets.find(s => s.name === cleanSetName) || sets[0];

    // 2) Build the card ID, e.g. "swsh3-136"
    const cardId = `${set.id}-${localIdStr}`;

    // 3) Fetch the full card
    const card = await tcgdex.card.get(cardId);

    if (!card) {
      console.log("TCGdex card not found:", cardId);
      return res.status(404).json({ error: "No matching TCGdex card found" });
    }

    // 4) Use the SDK helper to get an image URL
    let imageUrl = null;

    if (typeof card.getImageURL === "function") {
      imageUrl =
        card.getImageURL("high", "png") ||
        card.getImageURL("low", "png");
    }

    // Fallback to raw field if present
    if (!imageUrl && card.image) {
      imageUrl = card.image;
    }

    if (!imageUrl) {
      return res.json({ imageUrl: null });
    }

    return res.json({
      imageUrl,
      tcgdexId: card.id,
      localId: card.localId ?? localIdStr,
      name: card.name,
      set: set.name,
    });
  } catch (err) {
    console.error("TCGdex /pokemon-image error:", err);
    return res.status(500).json({ error: "Server error while fetching Pokémon image" });
  }
});



// =======================
// Error Handling Middleware
// =======================
app.use((err, req, res, next) => {
    console.error(err.stack); 
    res.status(500).send('Something broke!'); 
});

// =======================
// Start Server
// =======================
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
