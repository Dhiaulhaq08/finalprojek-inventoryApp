const pool = require('../config/database'); // Pastikan ini sesuai dengan pengaturan database Anda
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { log } = require('console');

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const register = async (req, res) => {
    const { username, email, password } = req.body;
  
    // Validasi input
    if (!username || !email || !password) {
      return res.render('v_authentication/register.ejs', { message: 'All fields are required' });
    }
  
    try {
      // Periksa apakah email sudah terdaftar
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  
      if (result.rows.length > 0) {
        return res.render('v_authentication/register.ejs', { message: 'Email already exists' });
      }
  
      // Enkripsi password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Membuat token verifikasi
      const verificationToken = crypto.randomBytes(20).toString('hex');
  
      // Masukkan user baru ke database (dengan status belum terverifikasi)
      const insertQuery =
        'INSERT INTO users (username, email, password, verification_token) VALUES ($1, $2, $3, $4) RETURNING *';
      const insertResult = await pool.query(insertQuery, [
        username,
        email,
        hashedPassword,
        verificationToken,
      ]);
  
      const newUser = insertResult.rows[0];
  
      // Kirim email verifikasi
      const verificationUrl = `${process.env.BASE_URL}/verify/${verificationToken}`;
  
      const msg = {
        to: email, // alamat email tujuan (pengguna)
        from: process.env.SENDGRID_SENDER, // email pengirim yang terdaftar di SendGrid
        subject: 'Email Verification',
        text: `Hello ${username},\n\nPlease verify your email by clicking the following link: ${verificationUrl}`,
        html: `
          <h3>Hello ${username},</h3>
          <p>Please verify your email by clicking the following link:</p>
          <a href="${verificationUrl}">Verify Email</a>
        `,
      };
  
      // Mengirim email menggunakan SendGrid
      await sgMail.send(msg);
  
      // Kirim response bahwa pendaftaran berhasil dan email verifikasi telah dikirim
      res.render('v_authentication/register', {
        message: `Registration successful! A verification email has been sent to ${email}. Please check your inbox.`,
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.render('v_authentication/register', { message: 'Server error' });
    }
  };
  

const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    // Cari token verifikasi di database
    const result = await pool.query('SELECT * FROM users WHERE verification_token = $1', [token]);

    if (result.rows.length === 0) {
      return res.render('v_authentication/verify', { message: 'Invalid or expired token' });
    }

    // Token ditemukan, perbarui status verifikasi pengguna
    const user = result.rows[0];
    await pool.query('UPDATE users SET is_verified = $1 WHERE id = $2', [true, user.id]);

    res.render('v_authentication/verify', { message: 'Your email has been verified successfully!' });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.render('v_authentication/verify', { message: 'An error occurred during email verification. Please try again later.' });
  }
};
const login = async (req, res) => {
    const { email, password } = req.body;
  
    // Validasi input
    if (!email || !password) {
      return res.render('v_authentication/login', { message: 'Email and password are required' });
    }
  
    try {
      // Cari pengguna berdasarkan email
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  
      if (result.rows.length === 0) {
        return res.render('v_authentication/login', { message: 'Invalid email or password' });
      }
  
      const user = result.rows[0];
  
      // Verifikasi apakah akun sudah terverifikasi
      if (!user.is_verified) {
        return res.render('v_authentication/login', { message: 'Please verify your email before logging in' });
      }
  
      // Verifikasi password
      const isPasswordValid = await bcrypt.compare(password, user.password);
  
      if (!isPasswordValid) {
        return res.render('v_authentication/login', { message: 'Invalid email or password' });
      }
  
      // Buat JWT Token
      const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET, // Pastikan Anda telah menambahkan JWT_SECRET di .env
        { expiresIn: '1h' } // Token berakhir dalam 1 jam
      );
  
      // Kirim token di response sebagai cookie atau header (misalnya, menggunakan header Authorization)
      res.cookie('token', token, { httpOnly: true, secure: true }); // pastikan menggunakan HTTPS di produksi
      res.redirect('/'); // Ganti dengan rute dashboard atau halaman yang sesuai
  
    } catch (error) {
      console.error('Error logging in:', error);
      res.render('v_authentication/login', { message: 'An error occurred during login. Please try again later.' });
    }
  };

module.exports = { register, verifyEmail,login };
