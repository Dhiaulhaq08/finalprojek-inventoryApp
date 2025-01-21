const pool = require('../config/database'); // Pastikan ini sesuai dengan pengaturan database Anda
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { log } = require('console');

dotenv.config();


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const register = async (req, res) => {
  const { username, email, password, role = 'user' } = req.body;

  if (!username || !email || !password) {
    return res.render('v_authentication/register.ejs', { message: 'All fields are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      return res.render('v_authentication/register.ejs', { message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(20).toString('hex');

    const insertQuery =
      'INSERT INTO users (username, email, password, role, verification_token) VALUES ($1, $2, $3, $4, $5)';
    await pool.query(insertQuery, [username, email, hashedPassword, role, verificationToken]);

    const verificationUrl = `${process.env.BASE_URL}/verify/${verificationToken}`;
    const msg = {
      to: email,
      from: process.env.SENDGRID_SENDER,
      subject: 'Email Verification',
      html: `<p>Verify your email by clicking <a href="${verificationUrl}">here</a>.</p>`,
    };

    await sgMail.send(msg);

    res.render('v_authentication/register', {
      message: `Registration successful! Check your email to verify.`,
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.render('v_authentication/register', { message: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('v_authentication/login', { message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.render('v_authentication/login', { message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.render('v_authentication/login', { message: 'Please verify your email first' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.render('v_authentication/login', { message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, { httpOnly: true, secure: false });
    res.redirect('/');
  } catch (error) {
    console.error('Error logging in:', error);
    res.render('v_authentication/login', { message: 'Server error' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query('SELECT * FROM users WHERE verification_token = $1', [token]);

    if (result.rows.length === 0) {
      return res.render('v_authentication/verify', { message: 'Invalid or expired token' });
    }

    await pool.query('UPDATE users SET is_verified = $1 WHERE verification_token = $2', [true, token]);
    res.render('v_authentication/verify', { message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.render('v_authentication/verify', { message: 'Server error' });
  }
};

const decodeUser = (req, res, next) => {
  const token = req.cookies.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Simpan data pengguna ke req.user
    } catch (err) {
      console.error('Error decoding token:', err);
    }
  }

  next();
};

module.exports = { register, login, verifyEmail,decodeUser };
