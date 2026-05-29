import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // Инициализация БД
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`;
    await sql`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, order_number VARCHAR(255) NOT NULL, expected_date DATE, client_number VARCHAR(255) NOT NULL, has_contact BOOLEAN DEFAULT FALSE, comments TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`;
  } catch (err) {
    console.error('Init DB error:', err);
  }

  const { method, url, body } = req;

  try {
    // Регистрация
    if (method === 'POST' && url === '/register') {
      const { username, password } = body;
      const result = await sql`INSERT INTO users (username, password) VALUES (${username}, ${password}) ON CONFLICT (username) DO NOTHING RETURNING id, username, created_at`;
      
      if (result.length === 0) {
        const existing = await sql`SELECT id, username, created_at FROM users WHERE username = ${username}`;
        return res.status(200).json(existing[0] || {});
      }
      return res.status(200).json(result[0]);
    }

    // Вход
    if (method === 'POST' && url === '/login') {
      const { username, password } = body;
      const result = await sql`SELECT id, username, created_at FROM users WHERE username = ${username} AND password = ${password}`;
      
      if (result.length === 0) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      }
      return res.status(200).json(result[0]);
    }

    // Получить заказы
    if (method === 'GET' && url.startsWith('/orders/')) {
      const userId = url.split('/orders/')[1].split('?')[0];
      const result = await sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`;
      return res.status(200).json(result);
    }

    // Создать заказ
    if (method === 'POST' && url === '/orders') {
      const { userId, orderNumber, expectedDate, clientNumber, hasContact, comments } = body;
      const result = await sql`INSERT INTO orders (user_id, order_number, expected_date, client_number, has_contact, comments) VALUES (${userId}, ${orderNumber}, ${expectedDate}, ${clientNumber}, ${hasContact}, ${comments}) RETURNING *`;
      return res.status(200).json(result[0]);
    }

    // Обновить заказ
    if (method === 'PUT' && url.startsWith('/orders/')) {
      const id = url.split('/orders/')[1].split('?')[0];
      const { orderNumber, expectedDate, clientNumber, hasContact, comments } = body;
      const result = await sql`UPDATE orders SET order_number = ${orderNumber}, expected_date = ${expectedDate}, client_number = ${clientNumber}, has_contact = ${hasContact}, comments = ${comments} WHERE id = ${id} RETURNING *`;
      return res.status(200).json(result[0]);
    }

    // Обновить статус связи
    if (method === 'PATCH' && url.includes('/contact')) {
      const id = url.split('/orders/')[1].split('/contact')[0];
      const { hasContact } = body;
      const result = await sql`UPDATE orders SET has_contact = ${hasContact} WHERE id = ${id} RETURNING *`;
      return res.status(200).json(result[0]);
    }

    // Удалить заказ
    if (method === 'DELETE' && url.startsWith('/orders/')) {
      const id = url.split('/orders/')[1].split('?')[0];
      await sql`DELETE FROM orders WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}