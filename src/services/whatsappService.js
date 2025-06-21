const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

const INSTANCES_DIR = path.join(__dirname, '../instances');
if (!fs.existsSync(INSTANCES_DIR)) fs.mkdirSync(INSTANCES_DIR);

const instances = {};

async function createInstance({ session_id, webhook_url, api_key, group }) {
    session_id = session_id || uuidv4();
    const authPath = path.join(INSTANCES_DIR, session_id);
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();
    let qrCodeString = null;

    async function startSock() {
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            getMessage: async () => ({}),
        });
        instances[session_id] = sock;

        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;
            if (qr) {
                qrCodeString = qr;
                qrcode.generate(qr, { small: true });
            }
            if (connection === 'close') {
                console.log('Conexão fechada. Tentando reconectar...');
                startSock();
            } else if (connection === 'open') {
                pool.query('UPDATE whatsapp_instances SET status = $1 WHERE session_id = $2', ['connected', session_id]);
                console.log(`[${session_id}] ✅ Conectado com sucesso ao WhatsApp! Status atualizado no banco.`);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            console.log(`[${session_id}] Mensagem recebida:`, JSON.stringify(m, null, 2));
        });
    }

    await startSock();

    // Espera o QR ser gerado
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout ao gerar QR Code')), 15000);
        const checkQR = () => {
            if (qrCodeString) {
                clearTimeout(timeout);
                resolve();
            } else {
                setTimeout(checkQR, 200);
            }
        };
        checkQR();
    });

    // Insere no banco
    await pool.query(
        'INSERT INTO whatsapp_instances (session_id, status, webhook_url, api_key, "group") VALUES ($1, $2, $3, $4, $5)',
        [session_id, 'pending', webhook_url, api_key, group]
    );

    return { session_id, qr: qrCodeString };
}

async function deleteInstance(session_id) {
    if (instances[session_id]) {
        try { instances[session_id].end(); } catch (e) {}
        delete instances[session_id];
    }
    const authPath = path.join(INSTANCES_DIR, session_id);
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
    }
    await pool.query('DELETE FROM whatsapp_instances WHERE session_id = $1', [session_id]);
}

async function restoreAllInstances() {
    const res = await pool.query("SELECT session_id FROM whatsapp_instances WHERE status IN ('pending', 'connected')");
    for (const row of res.rows) {
        const session_id = row.session_id;
        const authPath = path.join(INSTANCES_DIR, session_id);
        if (fs.existsSync(authPath)) {
            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            const { version } = await fetchLatestBaileysVersion();
            async function startSock() {
                const sock = makeWASocket({
                    version,
                    auth: state,
                    printQRInTerminal: false,
                    getMessage: async () => ({}),
                });
                instances[session_id] = sock;

                sock.ev.on('connection.update', (update) => {
                    const { connection } = update;
                    if (connection === 'close') {
                        console.log(`[${session_id}] Conexão fechada. Tentando reconectar...`);
                        startSock();
                    } else if (connection === 'open') {
                        pool.query('UPDATE whatsapp_instances SET status = $1 WHERE session_id = $2', ['connected', session_id]);
                        console.log(`[${session_id}] ✅ Conectado com sucesso ao WhatsApp! Status atualizado no banco.`);
                    }
                });

                sock.ev.on('creds.update', saveCreds);

                sock.ev.on('messages.upsert', async (m) => {
                    console.log(`[${session_id}] Mensagem recebida:`, JSON.stringify(m, null, 2));
                });
            }
            await startSock();
        } else {
            // Se a pasta não existe, marque como desconectado
            await pool.query('UPDATE whatsapp_instances SET status = $1 WHERE session_id = $2', ['disconnected', session_id]);
            console.log(`[${session_id}] Pasta de sessão não encontrada. Status atualizado para 'disconnected'.`);
        }
    }
}

module.exports = { createInstance, deleteInstance, restoreAllInstances }; 