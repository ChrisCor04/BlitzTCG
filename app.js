import express from 'express';
import { getUsers, createuser } from './test.js';   
import dotenv from 'dotenv';


const app = express();
app.use(express.json());

app.use(express.static('public'));

app.post('/login', async (req, res, next) => {
    try{
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const users = await getUsers();
        const user = users.find(u => u.email === email && u.pass === password);
        if (!user){
            return res.status(401).json({ error: 'Password or Email is incorrect' });
        }
        return res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        next(error);
    }
});
app.post('/signup', async (req, res, next) => {
    try{
        const { email, password , name} = req.body;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Name, Email and password are required.' });
        }
        if (password.length < 8){
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }
        if (!emailRegex.test(email)){
            return res.status(400).json({ error: 'Invalid email format. Must not contain @ and must have domain.' });
        }

        await createuser(name, email, password);
        return res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });

    }
});
app.use((err, req, res, next) => {
  console.error(err.stack); 
  res.status(500).send('Something broke!'); 
})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
})