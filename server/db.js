// server/db.js
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "root",
};

// 1. Garantir que o Banco Existe
const tempConnection = await mysql.createConnection(dbConfig);
await tempConnection.query(`CREATE DATABASE IF NOT EXISTS linkiverse_scraper`);
await tempConnection.end();

// 2. Conectar com o Banco Selecionado
const connection = await mysql.createConnection({
    ...dbConfig,
    database: "linkiverse_scraper"
});

export const db = drizzle(connection);
console.log(">>> [DB] Conectado e Banco Verificado!");
