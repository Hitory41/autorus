import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Инициализация БД (создание таблиц если нет)
async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_number VARCHAR(255) NOT NULL,
        expected_date DATE,
        client_number VARCHAR(255) NOT NULL,
        has_contact BOOLEAN DEFAULT FALSE,
        comments TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    `;
    console.log('✅ База данных инициализирована');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
  }
}

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await sql`
      INSERT INTO users (username, password)
      VALUES (${username}, ${password})
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username, created_at;
    `;
    
    if (result.length === 0) {
      // Пользователь уже существует, получаем его
      const existing = await sql`
        SELECT id, username, created_at FROM users WHERE username = ${username};
      `;
      res.json(existing[0]);
    } else {
      res.json(result[0]);
    }
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: err.message });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await sql`
      SELECT id, username, created_at FROM users 
      WHERE username = ${username} AND password = ${password};
    `;
    
    if (result.length === 0) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
    } else {
      res.json(result[0]);
    }
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: err.message });
  }
});

// Получить заказы пользователя
app.get('/api/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await sql`
      SELECT * FROM orders 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT 100;
    `;
    res.json(result);
  } catch (err) {
    console.error('Ошибка загрузки заказов:', err);
    res.status(500).json({ error: err.message });
  }
});

// Создать заказ
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, orderNumber, expectedDate, clientNumber, hasContact, comments } = req.body;
    const result = await sql`
      INSERT INTO orders (user_id, order_number, expected_date, client_number, has_contact, comments)
      VALUES (${userId}, ${orderNumber}, ${expectedDate}, ${clientNumber}, ${hasContact}, ${comments})
      RETURNING *;
    `;
    res.json(result[0]);
  } catch (err) {
    console.error('Ошибка создания заказа:', err);
    res.status(500).json({ error: err.message });
  }
});

// Обновить заказ
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { orderNumber, expectedDate, clientNumber, hasContact, comments } = req.body;
    const result = await sql`
      UPDATE orders 
      SET order_number = ${orderNumber}, 
          expected_date = ${expectedDate}, 
          client_number = ${clientNumber}, 
          has_contact = ${hasContact}, 
          comments = ${comments}
      WHERE id = ${id}
      RETURNING *;
    `;
    res.json(result[0]);
  } catch (err) {
    console.error('Ошибка обновления заказа:', err);
    res.status(500).json({ error: err.message });
  }
});

// Обновить статус связи
app.patch('/api/orders/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;
    const { hasContact } = req.body;
    const result = await sql`
      UPDATE orders 
      SET has_contact = ${hasContact}
      WHERE id = ${id}
      RETURNING *;
    `;
    res.json(result[0]);
  } catch (err) {
    console.error('Ошибка обновления статуса:', err);
    res.status(500).json({ error: err.message });
  }
});

// Удалить заказ
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM orders WHERE id = ${id};`;
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления заказа:', err);
    res.status(500).json({ error: err.message });
  }
});

// Запуск инициализации БД и сервера
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  });
});
