import express from 'express'; const app = express(); app.get('*', (req, res) => res.json({ message: 'Minimal JS works on NEW PROJECT' })); export default app;
