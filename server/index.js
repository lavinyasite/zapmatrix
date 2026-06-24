// server/index.js
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { sql } from 'drizzle-orm';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

let scraperProcess = null;

// 1. Status
app.get('/api/status', (req, res) => {
    res.json({ running: !!scraperProcess, pid: scraperProcess?.pid });
});

// 2. Stats
app.get('/api/stats', async (req, res) => {
    try {
        const [result] = await db.execute(sql`SELECT COUNT(*) as count FROM profiles`);
        const total = result[0].count;
        const [recent] = await db.execute(sql`SELECT name, phone, country, city, languages, age, scraped_at FROM profiles ORDER BY id DESC LIMIT 5`);
        res.json({ total, recent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. TODOS os Perfis COM FILTROS (busca simples)
app.get('/api/profiles', async (req, res) => {
    try {
        const { search, limit = 500 } = req.query;

        // Se tem busca, filtra; senão retorna todos
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            const [rows] = await db.execute(sql`
                SELECT id, name, phone, country, city, languages, age, scraped_at 
                FROM profiles 
                WHERE name LIKE ${searchTerm} 
                   OR phone LIKE ${searchTerm}
                   OR country LIKE ${searchTerm}
                   OR city LIKE ${searchTerm}
                   OR languages LIKE ${searchTerm}
                ORDER BY id DESC 
                LIMIT 500
            `);
            res.json(rows);
        } else {
            // Sem filtro - retorna todos
            const [rows] = await db.execute(sql`
                SELECT id, name, phone, country, city, languages, age, scraped_at 
                FROM profiles 
                ORDER BY id DESC 
                LIMIT 500
            `);
            res.json(rows);
        }
    } catch (error) {
        console.error("Erro /api/profiles:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Opções de Filtro (países únicos, cidades, etc)
app.get('/api/filters', async (req, res) => {
    try {
        const [countries] = await db.execute(sql`SELECT DISTINCT country FROM profiles WHERE country != '' ORDER BY country`);
        const [cities] = await db.execute(sql`SELECT DISTINCT city FROM profiles WHERE city != '' ORDER BY city`);
        res.json({
            countries: countries.map(c => c.country),
            cities: cities.map(c => c.city)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4.1 EXCLUIR Múltiplos Perfis (por IDs)
app.post('/api/profiles/delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "IDs não fornecidos" });
        }

        // Garante que são números (segurança)
        const safeIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

        if (safeIds.length === 0) return res.status(400).json({ error: "IDs inválidos" });

        // Executa delete direto
        await db.execute(sql.raw(`DELETE FROM profiles WHERE id IN (${safeIds.join(',')})`));

        res.json({ message: `${safeIds.length} perfis excluídos!` });
    } catch (error) {
        console.error("Erro delete:", error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Iniciar Robô
app.post('/api/start', (req, res) => {
    if (scraperProcess) return res.status(400).json({ message: "Já rodando!" });

    const targetUrl = req.body.url || 'https://www.eurogirlsescort.com/escorts/milan/';
    const scriptPath = path.join(PROJECT_ROOT, 'scraper_runner.py');

    scraperProcess = spawn('python', ['-u', scriptPath, targetUrl], { cwd: PROJECT_ROOT });
    scraperProcess.stdout.on('data', (data) => console.log(`[Scraper]: ${data}`));
    scraperProcess.stderr.on('data', (data) => console.error(`[Scraper Error]: ${data}`));
    scraperProcess.on('close', () => { scraperProcess = null; });

    res.json({ message: "Iniciado!", pid: scraperProcess.pid, url: targetUrl });
});

// 6. Parar Robô
app.post('/api/stop', (req, res) => {
    if (!scraperProcess) return res.status(400).json({ message: "Não rodando." });
    scraperProcess.kill('SIGTERM');
    scraperProcess = null;
    spawn('taskkill', ['/F', '/IM', 'chrome.exe']);
    spawn('taskkill', ['/F', '/IM', 'chromedriver.exe']);
    res.json({ message: "Parado!" });
});

// 7. Export CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const [rows] = await db.execute(sql`SELECT name, phone, country, city, languages, age FROM profiles ORDER BY id DESC`);
        let csv = "Nome,Telefone,Pais,Cidade,Idiomas,Idade\n";
        rows.forEach(r => {
            csv += `"${r.name}","${r.phone}","${r.country || ''}","${r.city || ''}","${r.languages || ''}","${r.age || ''}"\n`;
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=contatos.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Export JSON
app.get('/api/export/json', async (req, res) => {
    try {
        const [rows] = await db.execute(sql`SELECT name, phone, country, city, languages, age, scraped_at FROM profiles ORDER BY id DESC`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. Listar Arquivos (atualizado para novo padrão {cidade}_lote_XXX.csv)
app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(PROJECT_ROOT)
            .filter(f => f.includes('_lote_') && f.endsWith('.csv'))
            .map(f => {
                const stats = fs.statSync(path.join(PROJECT_ROOT, f));
                return { name: f, size: (stats.size / 1024).toFixed(2) + ' KB', modified: stats.mtime.toLocaleString('pt-BR') };
            });
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. Download Arquivo
app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(PROJECT_ROOT, req.params.filename);
    if (fs.existsSync(filePath) && req.params.filename.includes('_lote_')) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: "Não encontrado" });
    }
});

// 11. EXCLUIR Arquivo
app.delete('/api/files/:filename', (req, res) => {
    const filePath = path.join(PROJECT_ROOT, req.params.filename);
    if (fs.existsSync(filePath) && req.params.filename.includes('_lote_')) {
        try {
            fs.unlinkSync(filePath);
            res.json({ message: `Arquivo ${req.params.filename} excluído!` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(404).json({ error: "Arquivo não encontrado" });
    }
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`>>> Server porta ${PORT}`));
