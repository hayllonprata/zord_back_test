const whatsappService = require('../services/whatsappService');

exports.createInstance = async (req, res) => {
    try {
        const { session_id, webhook_url, api_key, group } = req.body;
        const result = await whatsappService.createInstance({ session_id, webhook_url, api_key, group });
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteInstance = async (req, res) => {
    try {
        const { id } = req.params;
        await whatsappService.deleteInstance(id);
        res.status(200).json({ message: 'Instância removida com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}; 