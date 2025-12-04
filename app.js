import express from 'express';
import { getUsers, createuser } from './test.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Node 18+ has fetch built-in, otherwise install 'node-fetch'

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

const BASE_URL = "https://api.justtcg.com/v1";
const HEADERS = { "x-api-key": process.env.JUSTTCG_API_KEY };

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

        return res.status(200).json({ message: 'Login successful' });
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
