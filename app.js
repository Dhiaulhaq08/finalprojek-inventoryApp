const express = require("express")
const app = express();
const fs = require('fs');
const c_login        = require('./controller/c_login')
const c_home         = require('./controller/c_home')
const c_tab          = require('./controller/c_table_products')
const categoryModel = require('./model/m_category');
const distributorModel = require('./model/m_distributors');
const bodyParser = require('body-parser');
const {authenticate, authorize , updateUserRole,getUsers , changePassword } = require('./controller/c_auth');
const { register, verifyEmail, login, decodeUser} = require('./controller/c_users');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const methodOverride = require("method-override");
const { Pool } = require("pg");
const multer = require('multer');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const flash = require('connect-flash');

dotenv.config();


app.set("view engine", "ejs");
app.set('views', "./views")
app.use(express.urlencoded({ extended: true }));
app.use( express.static('public') )
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cookieParser());
app.use(methodOverride("_method"));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Menyimpan file dalam folder 'uploads'
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname); // Menyimpan file dengan nama unik
  }
});

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'pre-uploads/'); // Menyimpan file dalam folder 'uploads'
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Menyimpan file dengan nama unik
  }
});
const upload = multer({ storage: storage });
const upload2 = multer({ storage: storage2 });
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const session = require('express-session');

app.use(session({
  secret: 'secret', // Ganti dengan string rahasia Anda
  resave: false,
  saveUninitialized: true
}));

app.use(flash());
//------------------------------------authentication-------------------------------------


app.get('/register', (req, res) => res.render('v_authentication/register'));
app.post('/register', register);

// app.get('/login', (req, res) => res.render('v_authentication/login'));
app.get('/login', (req, res) => res.render('v_authentication/login'));
app.post('/login', login);

app.get('/verify/:token', verifyEmail);


// app.get('/dashboard', authenticate, (req, res) => {
//   res.render('v_authentication/dashboard', { user: req.user });
// });

app.get('/',authenticate, async (req, res) => {
  // res.render('dashboard');
  try {
    const shipmentResult = await pool.query(`
      SELECT 
s.id AS shipment_id, 
p.nama_produk, 
s.jumlah_kirim, 
s.tanggal_kirim, 
a.name AS distributor_1
FROM 
shipment s
JOIN 
 produk p ON s.product_id = p.id
JOIN 
added_to a ON s.added_to = a.name;
  `);


  // res.render('index', { shipments });
  res.render('index', { shipments : shipmentResult.rows, user: req.user  });
}catch (error) {
  console.error('Error fetching shipment details:', error);
  res.status(500).send('Error fetching shipment details');
}
 
});
app.get('/logout', (req, res) => {
    res.clearCookie('token'); // Menghapus token dari cookie
    res.redirect('/login');   // Mengarahkan kembali ke halaman login
  });

  app.use((req, res, next) => {
    const publicRoutes = ['/login', '/register', '/verify/:token'];
    if (publicRoutes.includes(req.path)) {
      return next(); // Jangan periksa autentikasi untuk route publik
    }
  
    const token = req.cookies.token;
    if (!token) {
      return res.redirect('/login'); // Arahkan ke login jika tidak ada token
    }
  
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.redirect('/login'); // Token tidak valid
      }
  
      req.user = decoded;
      next();
    });
  });
  app.get('/admin/manage-roles', authenticate, authorize(['superadmin']),async (req, res) => {
    try {
      const successMessage = req.flash('success');
      const errorMessage = req.flash('error');
      const result = await pool.query('SELECT id, username,email, role FROM users ORDER BY role');
      res.render('v_authentication/updateRole.ejs', { user: result.rows, message: null,successMessage, errorMessage });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).send('Error fetching users.');
    }
  });
  app.post('/admin/update-role', authenticate, authorize(['superadmin']), updateUserRole);
  
  app.use(decodeUser);
  app.use((req, res, next) => {
    res.locals.user = req.user || null; // Kirim data pengguna ke semua template
    next();
  });
  app.get('/change-password', authenticate, (req, res) => {
    res.render('v_authentication/changePassword', { message: null });
  });
  
  app.post('/change-password', authenticate, changePassword);
  app.get('/chart', async (req, res) => {
    try {
      const shipmentResult = await pool.query(`
        SELECT 
  s.id AS shipment_id, 
  p.nama_produk, 
  s.jumlah_kirim, 
  s.tanggal_kirim, 
  a.name AS distributor_1
  FROM 
  shipment s
  JOIN 
   produk p ON s.product_id = p.id
  JOIN 
  added_to a ON s.added_to = a.name;
    `);
  
    const shipments = shipmentResult.rows;
        
    // res.render('index', { shipments });
    res.json(shipments);
  } catch (error) {
    console.error('Error fetching shipment details:', error);
    res.status(500).send('Error fetching shipment details');
  }
  })
  
  app.post('/admin/delete-user/:id', async (req, res) => {
    const userId = req.params.id;
  
    try {
      const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      if (result.rowCount === 0) {
        req.flash('error', 'User not found.');
        return res.redirect('/admin/manage-roles');
      }

      // Menambahkan notifikasi sukses
      req.flash('success', 'User deleted successfully.');
      return res.redirect('/admin/manage-roles');
      
    } catch (error) {
      console.error('Error deleting user:', error);
      req.flash('error', 'An error occurred while deleting user.');
      return res.redirect('/admin/manage-roles');
    }
});

  app.get('/',authenticate, async (req, res) => {
    const role = req.query.role
    const user = req.user;
    // res.render('dashboard');
    try {
      const shipmentResult = await pool.query(`
        SELECT 
  s.id AS shipment_id, 
  p.nama_produk, 
  s.jumlah_kirim, 
  s.tanggal_kirim, 
  a.name AS distributor_1
  FROM 
  shipment s
  JOIN 
   produk p ON s.product_id = p.id
  JOIN 
  added_to a ON s.added_to = a.name;
    `);
  
  const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
    // res.render('index', { shipments });
    res.render('index', { shipments : shipmentResult.rows,role, user });
  }catch (error) {
    console.error('Error fetching shipment details:', error);
    res.status(500).send('Error fetching shipment details');
  }
   
  });
  
  // app.get('/',authenticate, c_home.halaman_home) 

// -----------------------Aplikasi CRUD----------------------------------------

app.get('/add',authenticate, authorize(['superadmin','admin_gudang','admin']), async (req, res) => {

  try {
    const categories = await pool.query('SELECT * FROM category');
    const addedBy = await pool.query(`SELECT * FROM users WHERE users.role IN ('admin_gudang', 'superadmin')`);
    const addedTo = await pool.query('SELECT * FROM added_to');
    const distributors = await pool.query('SELECT * FROM distributors');
    const produk_distributor = await pool.query('SELECT * FROM distributor_produk');
    const result = await pool.query(`
      SELECT dp.id AS produk_id, dp.nama_produk, d.id AS distributor_id, d.nama_distributor
      FROM distributor_produk dp
      JOIN distributors d ON dp.distributor_id = d.id
    `);

    res.render('v_product_table/add_product.ejs', {
      categories: categories.rows,
      addedBy: addedBy.rows,
      addedTo: addedTo.rows,
      distributors: distributors.rows,
      produk_distributors: produk_distributor.rows,
      produk : result.rows
    });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});

// Route untuk menangani form tambah produk dengan gambar
app.post('/add', upload.single('product_picture'), async (req, res) => {
  const { nama_produk, category_id, jumlah_produk, added_by_id, added_to_id, distributors_id, qr_code, is_sale } = req.body;

  // Menangani file yang di-upload (menggunakan path file yang disimpan di server)
  const productPicture = req.file ? `/uploads/${req.file.filename}` : "/uploads/placeholder.png"; // Menangani gambar yang di-upload

  // Query untuk menyimpan data produk ke dalam PostgreSQL
  const query = `
    INSERT INTO produk (
      nama_produk, product_picture, category_id, jumlah_produk, added_to_id, distributors_id, qr_code, is_sale
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `;
  const values = [
    nama_produk,
    productPicture,  // Gambar yang di-upload disimpan sebagai path
    category_id,
    jumlah_produk,
    added_to_id,
    distributors_id,
    qr_code,
    is_sale
  ];
  
  try {
    const result = await pool.query(query, values);
    const newProductId = result.rows[0].id;
    const sender_id = result.rows[0].added_by_id;
    const distributor_id = result.rows[0].distributors_id; 
    const send_to_id = result.rows[0].added_to_id;
    const tanggal_kirim = new Date();
    await pool.query(
      'INSERT INTO laporan_pengiriman (sender_id, product_id, distributor_id, send_to_id, tanggal_kirim) VALUES ($1, $2, $3, $4, $5)',
      [sender_id, newProductId, distributor_id, send_to_id, tanggal_kirim]
    );

    console.log('Product added with ID:', result.rows[0].id);
    res.redirect('/inventory/products'); // Kembali ke halaman utama setelah menambahkan produk
  } catch (err) {
    console.error('Error inserting product:', err);
    res.status(500).send('Error adding product');
  }
});

// Route untuk menampilkan daftar produk
app.get('/inventory/products',authenticate, authorize(['superadmin','admin_gudang','admin']), async (req, res) => {

  try {
    // const message = req.session.message; // Ambil pesan dari session
    // delete req.session.message; // Hapus pesan setelah diambil
    const notifications = req.session.notifications || []; // Ambil notifikasi dari session
    const notificationCount = notifications.length;
    const page = parseInt(req.query.page) || 1; // Halaman yang diminta (default ke 1)
    const perPage = 3; // 10 produk per halaman
    const offset = (page - 1) * perPage; // Offset untuk query
  
    // Ambil produk dari database
    const result = await pool.query('SELECT * FROM produk WHERE is_delete = false LIMIT $1 OFFSET $2', [perPage, offset]);
    const totalProducts = await pool.query('SELECT COUNT(*) FROM produk WHERE is_delete = false'); // Total produk untuk pagination
    const totalPages = Math.ceil(totalProducts.rows[0].count / perPage); // Hitung total halaman
    // const result = await pool.query('SELECT * FROM produk');
    const categoryResult = await pool.query('SELECT * FROM category');
    res.render('v_product_table/product-home.ejs', { products: result.rows,categories: categoryResult.rows,
      currentPage: page,
      totalPages: totalPages,
      // message,
      notifications, 
      notificationCount 
     });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Error fetching products');
  }
});

    app.use('/uploads', express.static('uploads'));
    app.post('/edit/:id', upload.single('product_picture'), async (req, res) => {
      const productId = req.params.id;
      const { nama_produk, category_id, jumlah_produk, qr_code, is_sale } = req.body;
      let product_picture = req.file ? req.file.path : null;
    
      if (!product_picture) {
        try {
          const productResult = await pool.query('SELECT product_picture FROM produk WHERE id = $1', [productId]);
          product_picture = productResult.rows[0].product_picture; // Ambil gambar lama
        } catch (err) {
          console.error('Error fetching product picture:', err);
          return res.status(500).send('Error fetching product picture');
        }
      }
      // Update data produk di database
      try {
        const updateQuery = `
          UPDATE produk
          SET 
            nama_produk = $1,
            category_id = $2,
            jumlah_produk = $3,
            qr_code = $4,
            is_sale = $5,
            product_picture = $6
          WHERE id = $7
        `;
        const values = [
          nama_produk, 
          category_id, 
          jumlah_produk, 
          qr_code, 
          is_sale ? true : false, 
          product_picture, 
          productId
        ];
    
        await pool.query(updateQuery, values);
        res.redirect('/inventory/products'); // Redirect ke halaman daftar produk setelah berhasil update
      } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Error updating product');
      }
    });
    //Detail Product
    app.get('/product/:id', async (req, res) => {
      try {
        const productId = req.params.id;
        const result = await pool.query('SELECT * FROM produk WHERE id = $1', [productId]);
        // const result = await pool.query(`
        //   SELECT p.*, c.*
        //   FROM produk p
        //   JOIN category c ON p.category_id = c.id
        //   WHERE p.id = $1
        // `, [productId]);
        if (result.rows.length > 0) {
          const product = result.rows[0];
          res.render('v_product_table/detail_produk.ejs', { product }); // Menampilkan halaman detail
        } else {
          res.status(404).send('Product not found');
        }
      } catch (err) {
        console.error('Error fetching product details:', err);
        res.status(500).send('Error fetching product details');
      }
    });
    // Delete Produk
  
    app.get('/delete/:id', async (req, res) => {
      try {
        const productId = req.params.id;
        
        // Ambil data produk untuk mengetahui lokasi gambar
        const productResult = await pool.query('SELECT product_picture FROM produk WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        const fs = require('fs');
       
        // Jika produk ditemukan dan ada gambar
        if (product && product.product_picture) {
          const imagePath = path.join(__dirname, product.product_picture); // Gabungkan path
          console.log('Deleting image at:', imagePath); // Debug: melihat path file yang dihapus
    
          // Cek apakah file gambar ada
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath); // Hapus file gambar
            console.log('File deleted');
          } else {
            console.log('File not found, skipping deletion.');
          }
        }
    
        // Hapus produk dari database
        await pool.query('UPDATE produk SET is_delete = true WHERE id = $1', [productId]);
    
        res.redirect('/inventory/products'); // Redirect kembali ke halaman daftar produk
      } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).send('Error deleting product');
      }
    });

// -----------------------Edit Database----------------------------------------
app.get('/database/edit', (req, res) => {
  res.render('v_database/edit-database.ejs');
});

app.get('/categories', async (req, res) => {
  const categories = await categoryModel.getCategories();
  res.render('v_database/category/category-home', { categories });
});

// Menambahkan kategori
app.get('/categories/new', (req, res) => {
  res.render('v_database/category/category-add.ejs');
});

app.post('/categories', async (req, res) => {
  const { name } = req.body;
  await categoryModel.addCategory(name);
  res.redirect('/categories');
});

app.get('/kategori/:nama_category/produk', async (req, res) => {
  const { nama_category } = req.params;

  try {
    // Query untuk mendapatkan ID kategori
    const kategoriQuery = `
      SELECT id 
      FROM category
      WHERE nama_category = $1
    `;
    const kategoriResult = await pool.query(kategoriQuery, [nama_category]);

    if (kategoriResult.rowCount === 0) {
      return res.status(404).send('Kategori tidak ditemukan.');
    }

    const kategoriId = kategoriResult.rows[0].id;

    // Query untuk mendapatkan produk berdasarkan kategori ID
    const produkQuery = `
      SELECT nama_produk 
      FROM produk 
      WHERE category_id = $1
    `;
    const produkResult = await pool.query(produkQuery, [kategoriId]);

    // Render halaman EJS dengan data
    res.render('v_database/category/category-edit.ejs', {
      kategori: nama_category,
      produk: produkResult.rows,
    });
  } catch (error) {
    console.error('Error:', error.stack);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

// Menghapus kategori
app.get('/categories/delete/:id', async (req, res) => {
  await categoryModel.deleteCategory(req.params.id);
  res.redirect('/categories');
});

app.get('/distributors', async (req, res) => {
  const result = await pool.query('SELECT * FROM distributors');
  res.render('v_database/distributors/distributors-home.ejs', { distributors1: result.rows });
});

//--------------------- Form untuk menambahkan distributor ----------------------
app.get('/add-distributors',async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM distributors');
    const distributors = result.rows;
    res.render('v_database/distributors/distributors-add.ejs', { distributors });
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
  
});

app.get('/distributor/:nama_distributor/produk', async (req, res) => {
  const { nama_distributor } = req.params;

  try {
    // Query untuk mendapatkan ID kategori
    const distributorQuery = `
      SELECT id 
      FROM distributors
      WHERE nama_distributor = $1
    `;
    const distributorResult = await pool.query(distributorQuery, [nama_distributor]);

    if (distributorResult.rowCount === 0) {
      return res.status(404).send('Kategori tidak ditemukan.');
    }

    const distributorId = distributorResult.rows[0].id;

    // Query untuk mendapatkan produk berdasarkan kategori ID
    const produkQuery = `
      SELECT nama_produk 
      FROM distributor_produk 
      WHERE distributor_id = $1
    `;
    const produkResult = await pool.query(produkQuery, [distributorId]);

    // Render halaman EJS dengan data
    res.render('v_database/distributors/distributor-list.ejs', {
      distributor: nama_distributor,
      produk: produkResult.rows,
    });
  } catch (error) {
    console.error('Error:', error.stack);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

// Proses tambah distributor
app.post('/add-distributor', async (req, res) => {
  const { distributor_option, nama_distributor, distributor_id, nama_produk ,alamat,kontak} = req.body;

  try {
    let selectedDistributorId;

    if (distributor_option === 'new' && nama_distributor) {
      // Tambahkan distributor baru
      const result = await pool.query(
        'INSERT INTO distributors (nama_distributor,alamat,kontak) VALUES ($1,$2,$3) RETURNING id',
        [nama_distributor,alamat,kontak]
      );
      selectedDistributorId = result.rows[0].id;
    } else if (distributor_option === 'existing' && distributor_id) {
      // Gunakan distributor yang sudah ada
      selectedDistributorId = distributor_id;
    }
   
    if (selectedDistributorId) {
      // Tambahkan produk ke distributor yang dipilih
      await pool.query(
        'INSERT INTO distributor_produk (distributor_id, nama_produk) VALUES ($1, $2)',
        [selectedDistributorId, nama_produk]
      );
    }
    if (!req.session.notifications) {
      req.session.notifications = [];
    }
    req.session.notifications.push(`Distributor "${nama_distributor}" dengan produk "${nama_produk}" berhasil ditambahkan.`);
    res.redirect('/distributors');
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan saat menyimpan data.');
  }
});
app.post('/clear-notifications', (req, res) => {
  req.session.notifications = []; // Kosongkan notifikasi di session
  res.sendStatus(200); // Kirim status sukses
});

// app.post('/add-distributors',upload.single('product_picture'), async (req, res) => {
//   const { nama_distributor, alamat, kontak, nama_produk } = req.body;

//   const productPicture = req.file ? `/uploads/${req.file.filename}` : "/uploads/placeholder.png";
//   const query = `
//   INSERT INTO distributors (
//     nama_distributor, alamat, kontak,
//   )
//   VALUES ($1, $2, $3, $4, $5)
//   RETURNING id;
// `;
// const values = [
//   nama_distributor, alamat, kontak, product_name, productPicture];
//   try {
    
//     const result = await pool.query(query, values);

//     // Simpan pesan notifikasi ke session
   
//     if (!req.session.notifications) {
//       req.session.notifications = [];
//     }
//     req.session.notifications.push(`Distributor "${nama_distributor}" dengan produk "${product_name}" berhasil ditambahkan.`);
//     // Redirect ke halaman produk
//     res.redirect(`/distributors`);
//   } catch (error) {
//     console.error('Error:', error.stack);
//     res.status(500).send('Terjadi kesalahan pada server.');
//   }
// });
// app.post('/clear-notifications', (req, res) => {
//   req.session.notifications = []; // Kosongkan notifikasi di session
//   res.sendStatus(200); // Kirim status sukses
// });

// Edit distributor
// app.get('/edit/:id', async (req, res) => {
//   const { id } = req.params;
//   const result = await pool.query('SELECT * FROM distributors WHERE id = $1', [id]);
//   res.render('v_database/distributors/distributors-edit.ejs', { distributor: result.rows[0] });
// });
app.get('/api/distributor/:id', async (req, res) => {
  const distributorId = req.params.id;
  try {
    const [distributor] = await db.query('SELECT * FROM distributors WHERE id = ?', [distributorId]);
    if (!distributor) {
      return res.status(404).json({ message: 'Distributor not found' });
    }
    res.json(distributor);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving distributor data', error });
  }
});

// Proses update distributor
app.post('/distributor/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { nama_distributor, alamat, kontak } = req.body;
  await pool.query('UPDATE distributors SET nama_distributor = $1, alamat = $2, kontak = $3 WHERE id = $4', [nama_distributor, alamat, kontak, id]);
  res.redirect('/distributors');
});

// Hapus distributor
app.get('/distributors/delete/:id', async (req, res) => {
  await distributorModel.deleteDistributor(req.params.id);
  res.redirect('/distributors');
});

// Hapus Produk dari distributor
// app.get('/delete-product/:id', async (req, res) => {
//   const product_name = req.params.nama_produk;

//   try {
//     // Query SQL untuk menghapus produk berdasarkan ID
//     const result = await pool.query('DELETE FROM distributor_produk WHERE nama_produk = ?', [product_name]);

//     if (result.affectedRows > 0) {
//       return res.json({ success: true });
//     } else {
//       return res.json({ success: false, message: 'Produk tidak ditemukan' });
//     }
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: 'Gagal menghapus produk' });
//   }
// });
app.get('/delete-item/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Ambil data produk untuk mengetahui lokasi gambar
    // const productResult = await pool.query('SELECT product_picture FROM produk WHERE id = $1', [productId]);
    // const product = productResult.rows[0];
    // const fs = require('fs');
   
    // // Jika produk ditemukan dan ada gambar
    // if (product && product.product_picture) {
    //   const imagePath = path.join(__dirname, product.product_picture); // Gabungkan path
    //   console.log('Deleting image at:', imagePath); // Debug: melihat path file yang dihapus

    //   // Cek apakah file gambar ada
    //   if (fs.existsSync(imagePath)) {
    //     fs.unlinkSync(imagePath); // Hapus file gambar
    //     console.log('File deleted');
    //   } else {
    //     console.log('File not found, skipping deletion.');
    //   }
    // }

    // Hapus produk dari database
    await pool.query('UPDATE produk SET is_delete = true WHERE id = $1', [productId]);

    res.redirect('/distributor/:nama_distributor/produk'); // Redirect kembali ke halaman daftar produk
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send('Error deleting product');
  }
});
//------------------------Shipment/Product Flow--------------------------------
app.get('/shipment-details',authenticate, authorize(['superadmin','admin_barang','admin']), async (req, res) => {
  try {
    // Ambil data pengiriman yang dihubungkan dengan nama produk dan nama distributor
    const shipmentResult = await pool.query(`
 SELECT 
  s.id AS shipment_id, 
  p.nama_produk, 
  s.jumlah_kirim, 
  s.tanggal_kirim, 
  a.name AS distributor_1
FROM 
  shipment s
JOIN 
   produk p ON s.product_id = p.id
JOIN 
  added_to a ON s.added_to = a.name;
    `);

    const shipments = shipmentResult.rows;

    res.render('v_shipment/shipment_list', { shipments });
  } catch (error) {
    console.error('Error fetching shipment details:', error);
    res.status(500).send('Error fetching shipment details');
  }
});

app.get("/add-shipment" ,async (req,res)=> { 
  try {
    // Ambil data pengiriman yang dihubungkan dengan nama produk dan nama distributor
    const shipmentResult = await pool.query(`
   SELECT 
  s.id AS shipment_id, 
  p.*,
  a.*,
  s.jumlah_kirim, 
  s.tanggal_kirim, 
  a.id AS distributor_1
FROM 
  shipment s
JOIN 
  produk p ON s.product_id = p.id
JOIN 
  added_to a ON s.added_to = a.name;


    `);
      const distributors_list = await pool.query(`
      SELECT * from distributors`)
      const products_list = await pool.query(`
        SELECT id, nama_produk, jumlah_produk
        FROM produk WHERE is_delete = false;
      `)
      const addedTo = await pool.query(`
        SELECT * FROM added_to;
        `)
      
    const products = shipmentResult.rows;
    const distributors = distributors_list.rows;
    const product_list = products_list.rows
    const added_to = addedTo.rows

  res.render('v_shipment/distribution.ejs',{status: req.query.status,products,distributors,product_list,added_to})
}catch (error) {
  console.error('Error fetching shipment details:', error);
  res.status(500).send('Error fetching shipment details');
}})

app.post('/send-products', async (req, res) => {
  const { product_id, distributor_1_id, jumlah_kirim_1, } = req.body;
  
  // 1. Ambil jumlah produk yang tersedia dari tabel produk
  const productResult = await pool.query('SELECT jumlah_produk FROM produk WHERE id = $1', [product_id]);
  const availableStock = productResult.rows[0].jumlah_produk;

  // 2. Cek apakah jumlah kirim lebih dari jumlah yang tersedia
  const totalSend = jumlah_kirim_1 ;
  if (totalSend > availableStock) {
    return res.status(400).send('Jumlah pengiriman melebihi stok yang tersedia');
  }

  // 3. Mengirim barang ke distributor pertama
  try {
    await pool.query(
      'INSERT INTO shipment (product_id, added_to, jumlah_kirim) VALUES ($1, $2, $3)',
      [product_id, distributor_1_id, jumlah_kirim_1]
    );

  

    // 5. Update stok produk yang tersedia
    const newStock = availableStock - totalSend;
    await pool.query('UPDATE produk SET jumlah_produk = $1 WHERE id = $2', [newStock, product_id]);

    // res.send('Produk berhasil dikirim ke kedua distributor');
    res.redirect('/add-shipment?status=success' );
  } catch (error) {
    console.error('Error sending products:', error);
    res.status(500).send('Error sending products');
  }
});
app.get('/aboutus', (req, res) => {
  const latitude = "40.730610"; // Ganti dengan nilai dinamis
  const longitude = "-73.935242"; // Ganti dengan nilai dinamis

  const mapUrl = `https://www.google.com/maps/embed?pb=...&q=${latitude},${longitude}`;

  res.render('v_about-us/about-us.ejs', { mapUrl });
});

const logStream = fs.createWriteStream(path.join(__dirname, 'app.log'), { flags: 'a' });
app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400,  // Skip log jika status code < 400 (yaitu bukan error)
  stream: logStream  // Menulis log ke file app.log
}));
const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=> {
    console.log("server running on port 5000");
})