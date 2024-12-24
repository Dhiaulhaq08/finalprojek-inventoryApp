const express = require("express")
const app = express();
const c_login        = require('./controller/c_login')
const c_home         = require('./controller/c_home')
const c_tab          = require('./controller/c_table_products')
const bodyParser = require('body-parser');
const { register, verifyEmail, login } = require('./controller/c_users');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const methodOverride = require("method-override");
const { Pool } = require("pg");
dotenv.config();

app.set("view engine", "ejs");
app.set('views', "./views")
app.use(express.urlencoded({ extended: true }));
app.use( express.static('public') )
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride("_method"));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.get('/', c_home.halaman_home)
// app.get('/inventory/products', c_tab.halaman_table_products)
// app.get('/login', c_login.halaman_login)
// app.post('/proses-login', c_login.proses_login)

// -----------------------------AUthencication--------------------------
app.get('/register', (req, res) => {
    res.render('v_authentication/register.ejs');
  });
  app.get('/verify/:token', verifyEmail);
  app.get('/login', (req, res) => {
      res.render('v_authentication/login');
    });
  app.post('/login', login);
  
  // Dashboard Route (hanya dapat diakses jika sudah login)
  app.get('/dashboard', (req, res) => {
    // Memeriksa apakah ada token JWT di cookie
    const token = req.cookies.token;
  
    if (!token) {
      return res.redirect('/login');
    }
  
    // Verifikasi JWT token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.redirect('/login');
      }
  
      res.render('v_authentication/dashboard.ejs', { user: decoded });
    });
  });
  app.post('/register', register);
  
  // Verifikasi Email
  app.get('/verify/:token', verifyEmail);  // Pastikan rute ini ada
  app.get('/logout', (req, res) => {
      res.clearCookie('token'); // Menghapus token dari cookie
      res.redirect('/login');   // Mengarahkan kembali ke halaman login
    });


// -----------------------Aplikasi CRUD----------------------------------------
    // app.get("/inventory/products", async (req, res) => {
    //   const { rows } = await pool.query("SELECT * FROM product ORDER BY id ASC");
    //   res.render("v_product_table/product-home.ejs", { product: rows });
    // });
    
    // // 2. Create (Form & Action)
    // app.get("/create", (req, res) => {
    //   res.render("v_product_table/add-product.ejs");
    // });
    
    // app.post("/create", async (req, res) => {
    //   const { nama_produk, category, jumlah_produk, added_by, added_to, distributor } = req.body;
    //   await pool.query(
    //     `INSERT INTO product (nama_produk, category, jumlah_produk, added_by, added_to, distributor) VALUES ($1, $2, $3, $4, $5, $6)`,
    //     [nama_produk, category, jumlah_produk, added_by, added_to, distributor]
    //   );
    //   res.redirect("/inventory/products");
    // });
    
    // // 3. Update (Form & Action)
    // app.get("/edit/:id", async (req, res) => {
    //   const { id } = req.params;
    //   const { rows } = await pool.query("SELECT * FROM product WHERE id = $1", [id]);
    //   res.render("v_product_table/edit-product.ejs", { produk: rows[0] });
    // });
    
    // app.put("/edit/:id", async (req, res) => {
    //   const { id } = req.params;
    //   const { nama_produk, category, jumlah_produk, added_by, added_to, distributor, is_sale } = req.body;
    //   await pool.query(
    //     `UPDATE produk SET nama_produk=$1, category=$2, jumlah_produk=$3, added_by=$4, added_to=$5, distributor=$6, is_sale=$7 WHERE id=$8`,
    //     [nama_produk, category, jumlah_produk, added_by, added_to, distributor, is_sale === "on", id]
    //   );
    //   res.redirect("/inventory/products");
    // });
    
    // // 4. Delete
    // app.delete("/delete/:id", async (req, res) => {
    //   const { id } = req.params;
    //   await pool.query("DELETE FROM product WHERE id = $1", [id]);
    //   res.redirect("/inventory/products");
    // });

    app.get('/inventory/products', async (req, res) => {
      try {
        const result = await pool.query('SELECT p.id, p.nama_produk, c.nama_category, p.jumlah_produk, ab.username AS added_by, at.name AS added_to, d.nama_distributor, p.qr_code, p.is_sale FROM produk p JOIN category c ON p.category_id = c.id JOIN added_by ab ON p.added_by_id = ab.id JOIN added_to at ON p.added_to_id = at.id JOIN distributors d ON p.distributors_id = d.id ORDER BY p.added_at DESC');
        res.render('v_product_table/product-home.ejs', { produk: result.rows });
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });
    
    // Form Add Produk
    app.get('/add', async (req, res) => {
      try {
        const categories = await pool.query('SELECT * FROM category');
        const distributors = await pool.query('SELECT * FROM distributors');
        const addedBy = await pool.query('SELECT * FROM added_by');
        const addedTo = await pool.query('SELECT * FROM added_to');
        res.render('v_product_table/add-product.ejs', { categories: categories.rows, distributors: distributors.rows, addedBy: addedBy.rows, addedTo: addedTo.rows });
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });
    
    // Add Produk
    app.post('/add', async (req, res) => {
      const { nama_produk, product_picture, category_id, jumlah_produk, added_by_id, added_to_id, distributors_id, qr_code, is_sale } = req.body;
      try {
        await pool.query('INSERT INTO produk (nama_produk, product_picture, category_id, jumlah_produk, added_by_id, added_to_id, distributors_id, qr_code, is_sale) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [nama_produk, product_picture, category_id, jumlah_produk, added_by_id, added_to_id, distributors_id, qr_code, is_sale]);
        res.redirect('/inventory/products');
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });
    
    // Form Edit Produk
    app.get('/edit/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const produk = await pool.query('SELECT * FROM produk WHERE id = $1', [id]);
        const categories = await pool.query('SELECT * FROM category');
        const distributors = await pool.query('SELECT * FROM distributors');
        const addedBy = await pool.query('SELECT * FROM added_by');
        const addedTo = await pool.query('SELECT * FROM added_to');
        res.render('edit', { produk: produk.rows[0], categories: categories.rows, distributors: distributors.rows, addedBy: addedBy.rows, addedTo: addedTo.rows });
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });
    
    // Edit Produk
    app.post('/edit/:id', async (req, res) => {
      const { id } = req.params;
      const { nama_produk, product_picture, category_id, jumlah_produk, added_by_id, added_to_id, distributors_id, qr_code, is_sale } = req.body;
      try {
        await pool.query('UPDATE produk SET nama_produk = $1, product_picture = $2, category_id = $3, jumlah_produk = $4, added_by_id = $5, added_to_id = $6, distributors_id = $7, qr_code = $8, is_sale = $9 WHERE id = $10', [nama_produk, product_picture, category_id, jumlah_produk, added_by_id, added_to_id, distributors_id, qr_code, is_sale, id]);
        res.redirect('/');
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });
    
    // Delete Produk
    app.get('/delete/:id', async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query('DELETE FROM produk WHERE id = $1', [id]);
        res.redirect('/');
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=> {
    console.log("server running on port 5000");
})