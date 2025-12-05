const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Connected to Engine Service");
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
