const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const LEVELS_DIR = path.join(__dirname, 'levels');

if (!fs.existsSync(LEVELS_DIR)) {
	fs.mkdirSync(LEVELS_DIR);
	console.log("Created level directory at", LEVELS_DIR);
}

function levelFilePath(id) {
	return path.join(LEVELS_DIR, `${id}.json`);
}

function writeLevel(id, blocks, callback) {
	const json = JSON.stringify(blocks);
	fs.writeFile(levelFilePath(id), json, "utf8", callback);
}

function readLevel(id, callback) {
	fs.readFile(levelFilePath(id), "utf8", (err, data) => {
		if (err) return callback(err);

		try {
			const blocks = JSON.parse(data);
			if (!Array.isArray(blocks)) {
				return callback(new Error("Level does not contain an array"));
			}
			callback(null, blocks);
		} catch (parseErr) {
			callback(parseErr);
		}
	});
}


// API
app.get('/api/v1/levels/:id', (req, res) => {
	const id = req.params.id;

	readLevel(id, (err, blocks) => {
		if (err) {
			console.error("Error reading level data:", err);
			return res.status(404).json({error: "Level not found"});
		}
		res.json({id, blocks});
	});
});


//API base
app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`)
});