import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import submissionsRouter from "./routes/submissions.js";

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({
    windowMs: 60*1000,
    max: 100,
    message: {error: {code: 'RATE_LIMITED', message: "Too many requests at a time!!!"}}
}));

app.use('/api/v1', submissionsRouter);

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
