import express from "express";
import path from "path";

const app = express();
const port = 3000;

// Serve static files from src directory
app.use(express.static("src"));

// Serve index.html for root path
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
    console.log(
        `\n🚀 Trading bot interface running at http://localhost:${port}`
    );
    console.log("Steps to get started:");
    console.log("1. Open the URL in your browser");
    console.log("2. Make sure Phantom wallet extension is installed");
    console.log('3. Click "Connect Phantom Wallet"');
    console.log("4. Start the trading bot\n");
});
