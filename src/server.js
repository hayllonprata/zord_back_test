require('dotenv').config();
const express = require('express');
const whatsappController = require('./controllers/whatsappController');
const auth = require('./middleware/auth');
const whatsappService = require('./services/whatsappService');

const app = express();
app.use(express.json());

// Restaura instâncias persistentes
whatsappService.restoreAllInstances();

app.post('/instances', auth, whatsappController.createInstance);
app.delete('/instance/:id', auth, whatsappController.deleteInstance);

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`✅ API rodando na porta ${PORT}`);
}); 