require('dotenv').config();

module.exports = (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (key && key === process.env.API_ACESS_KEY) {
        return next();
    }
    return res.status(401).json({ error: '❌ Acesso não autorizado.' });
}; 