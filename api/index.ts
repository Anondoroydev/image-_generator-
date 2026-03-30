import e from 'express';
const appWithHealth = e();

appWithHealth.get('/vercel-ping', (req, res) => {
  res.json({ 
    status: 'Vercel Entry Point OK',
    time: new Date().toISOString()
  });
});

// Use dynamic import to catch top-level errors and report them
const startApp = async () => {
  try {
    const { app } = await import('../src/app.ts');
    appWithHealth.use(app);
    console.log('Main app imported successfully');
  } catch (err: any) {
    console.error('Failed to import main app:', err);
    // If it fails, we still have the /vercel-ping route and this error handler
    appWithHealth.all('*', (req, res) => {
      res.status(500).json({ 
        error: 'Main app initialization failed', 
        message: err.message,
        stack: err.stack 
      });
    });
  }
};

startApp();

export default appWithHealth;
