const path = require('path');
const express = require('express');
const cors = require('cors');
const pg = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const admin = require('firebase-admin');

require('dotenv').config();

const app = express();
const port = 3010;
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

app.use(cors());
app.use(express.json());

// Firebase setup
const serviceAccount = require(process.env.FIREBASE_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'twitter-app-90521.appspot.com',
});
const bucket = admin.storage().bucket();

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
});

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

app.post('/add-pet', upload.single('image'), async (req,res) => {
  try {
    const { name, age, breed, description, status } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).send('No image uploaded');
    }

    const fileName = file.originalname;
    const fileRef = bucket.file(`pets/${fileName}`);

    await fileRef.save(file.buffer, {
      metadata: { contentType: file.mimetype },
    });

    const [uploadedFileUrl] = await fileUpload.getSignedUrl({
      action: 'read',
      expires: '03-01-2500',
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    const query = `
      INSERT INTO pets (name, age, breed, description, status, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [name, age, breed, description, status, imageUrl];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});

app.get('/pets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pets WHERE status = "Active"');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});


app.put('/pets/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, age, breed, description, status } = req.body;
  const file = req.file;

  try {
    const petResult = await pool.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (petResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    let imageUrl = petResult.rows[0].image_url;

    if (file) {
      const fileName = file.originalname;
      const fileUpload = bucket.file(`pets/${fileName}`);

      await fileUpload.save(file.buffer, {
        metadata: { contentType: file.mimetype },
      });

      const [uploadedFileUrl] = await fileUpload.getSignedUrl({
        action: 'read',
        expires: '03-01-2500',
      });

      imageUrl = uploadedFileUrl;
    }

    await pool.query(
      'UPDATE pets SET name = $1, age = $2, breed = $3, description = $4, status = $5, image_url = $6 WHERE id = $7',
      [name, age, breed, description, status, imageUrl, id]
    );

    res.json({ message: 'Pet updated successfully', imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update pet' });
  }
});


app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'pages/index.html'));
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
