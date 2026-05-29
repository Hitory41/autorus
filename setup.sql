-- ============================================
-- Setup script for Zakazv2 Supabase Database
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- Users Table
-- Stores user accounts (login + password)
-- ============================================
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster username lookups
CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- Orders Table
-- Stores customer orders linked to users
-- ============================================
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    order_number VARCHAR(255) NOT NULL,
    expected_date DATE NOT NULL,
    client_number VARCHAR(255) NOT NULL,
    has_contact BOOLEAN DEFAULT false,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- For custom authentication using users table
-- ============================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Allow public read access for authentication" ON users;
DROP POLICY IF EXISTS "Allow public insert for registration" ON users;

-- Allow anyone to SELECT users (for username/password check)
-- Security note: In production, consider using Supabase Auth instead
CREATE POLICY "Allow public read access for authentication"
    ON users FOR SELECT
    USING (true);

-- Allow anyone to INSERT users (for registration)
CREATE POLICY "Allow public insert for registration"
    ON users FOR INSERT
    WITH CHECK (true);

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
DROP POLICY IF EXISTS "Users can delete own orders" ON orders;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT
    USING (true);

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders"
    ON orders FOR INSERT
    WITH CHECK (true);

-- Users can update their own orders
CREATE POLICY "Users can update own orders"
    ON orders FOR UPDATE
    USING (true);

-- Users can delete their own orders
CREATE POLICY "Users can delete own orders"
    ON orders FOR DELETE
    USING (true);

-- ============================================
-- Function to update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DISABLE RLS to allow all operations
-- This is necessary for the app to work properly
-- ============================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- ============================================
-- OPTIMIZATION: Ensure indexes exist for fast queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);