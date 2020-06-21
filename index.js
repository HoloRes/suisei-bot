// Packages
const Discord = require("discord.js"),
    mongoose = require("mongoose"), // Library for MongoDB
    express = require("express"), // Web server
    hbs = require("hbs"); // Handlebars

// Express init
const app = express();

app.use(express.static("public")); // Set public as static files folder, can be uses for JS and CSS files
app.set('view engine', 'hbs'); // Set the view engine to Handlebars

app.listen(3000); // Start the web server on port 3000
console.log("Express is listening");

// Routers
app.get('/', (req, res) => {
    res.render("index", {
        music: [
            {
                "name": "NEXT COLOR PLANET",
                "author": "Hoshimachi Suisei",
                "id": "1"
            }
        ]
    });
});

app.get('/player/:id', (req, res) => {
    const music = {
        "name": "NEXT COLOR PLANET",
        "author": "Hoshimachi Suisei",
        "id": "1"
    }
    if (req.params.id === music.id) return res.render("player", {music: music});
    else res.status(400).send("Page not found")
});