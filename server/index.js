
import dotenv from "dotenv";
dotenv.config();

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Subchat server running on http://localhost:${PORT}`);
});
