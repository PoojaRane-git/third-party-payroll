const express = require("express");
const cors = require("cors");

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://saarthi-third-party-payroll.vercel.app"
];

const previewOriginPattern =
    /^https:\/\/(?:third-party-payroll|saarthi-third-party-payroll)-[a-z0-9-]+\.vercel\.app$/;

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || previewOriginPattern.test(origin)) {
            return callback(null, true);
        }

        console.error("❌ CORS blocked origin:", origin);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

// ...routes here

module.exports = app; // for Vercel serverless
// or app.listen(PORT) for local