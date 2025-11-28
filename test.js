import postgres from 'postgres'
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL
const sql = postgres(connectionString)

export default sql
export async function getUsers(){
    const users = await sql`SELECT * FROM userlogininfo`;
    console.log(users);
    return users;
}

export async function createuser(name, email, password) {
  try {
    return await sql`
      INSERT INTO userlogininfo (username, email, pass)
      VALUES (${name}, ${email}, ${password})
    `;
  } catch (err) {
    console.error('Error creating user:', err);
    throw err;
  }
}


getUsers();