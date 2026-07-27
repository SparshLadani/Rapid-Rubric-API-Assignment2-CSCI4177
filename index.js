import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import submissionsRouter from "./routes/submissions.js";
import compression from 'compression';
import helmet from 'helmet';
import { register, httpRequestDuration } from './middleware/metrics.js';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(compression());
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});


app.use(rateLimit({
    windowMs: 60*1000,
    max: 100,
    message: {error: {code: 'RATE_LIMITED', message: "Too many requests at a time!!!"}}
}));

app.use('/api/v1', submissionsRouter);

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

app.use((err, req, res, next) => {
    console.error(err);
    if(err.code === 'LIMIT_FILE_SIZE'){
        return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 20MB limit.' } });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
