const path = require('path');
const express = require('express');
const cors = require('cors');
const pg = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = express();
const port = 3010;
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

app.use(cors());
app.use(express.json());

app.post('/signup', async (req, res) => {
  const { first_name, last_name, phone_number, email, password } = req.body;

  try {
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE email = $1', 
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json('User already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO users (first_name, last_name, phone_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING id', 
      [first_name, last_name, phone_number, email, password]
    );
    const user = result.rows[0];

    res.status(200).json({
      message: 'User create successfully',
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json(
      { error: 'Registration failed', 
      details: error.message }
    );
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Wrong password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(resolve(__dirname, 'pages/index.html'));
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
