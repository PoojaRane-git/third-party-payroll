
const allowedOrigins = [
    "http://localhost:5173",

    // Personal Vercel deployment
    "https://third-party-payroll.vercel.app",

    // New Talent Corner Vercel deployment
    "https://saarthi-third-party-payroll.vercel.app"
];

// Allow preview deployments
const previewOriginPattern =
    /^https:\/\/(?:third-party-payroll|saarthi-third-party-payroll)-[a-z0-9-]+\.vercel\.app$/;

const corsOptions = {
    origin: function (origin, callback) {

        // Allow requests without Origin
        if (!origin) {
            return callback(null, true);
        }

        if (
            allowedOrigins.includes(origin) ||
            previewOriginPattern.test(origin)
        ) {
            console.log("✅ CORS allowed:", origin);
            return callback(null, true);
        }

        console.error("❌ CORS blocked origin:", origin);
        return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "apikey",
        "x-client-info"
    ],

    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));